//! Wallpaper files for workspaces. Images are copied into one folder, named by a hash of their contents,
//! so the layout only ever stores a plain file name.

use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageFormat, ImageReader, codecs::gif::GifDecoder, codecs::jpeg::JpegEncoder, imageops::FilterType};
use webp_animation::{Encoder, EncoderOptions, EncodingConfig, EncodingType, LossyEncodingConfig};
use std::io::Cursor;
use tauri::ipc::Channel;

/// Longest side of a stored still image. A wallpaper is shown at window size, so bigger files add only cost.
const MAX_SIDE: u32 = 2560;
/// The formats the importer decodes, named for error messages.
const SUPPORTED: &str = "Use a PNG, JPEG, WebP, GIF, BMP, or TIFF file.";

/// WebP quality for animations, 0 to 100. Lower is smaller and blurrier.
const WEBP_QUALITY: f32 = 70.0;
/// JPEG quality for opaque stills. Visually close to the source, and much smaller than the original.
const JPEG_QUALITY: u8 = 85;

fn wallpapers_dir() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(std::path::PathBuf::from(home).join("Library/Application Support/Haya/wallpapers"))
}

/// A stored name is 8 to 64 lowercase hex characters, a dot, then an image extension. Nothing else is accepted.
fn is_safe_name(name: &str) -> bool {
    let Some((stem, ext)) = name.rsplit_once('.') else { return false };
    (8..=64).contains(&stem.len())
        && stem.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
        && matches!(ext, "png" | "jpg" | "jpeg" | "webp" | "gif")
}

/// 64-bit FNV-1a over the bytes, as hex. Deterministic across runs, so the same image maps to the same file.
fn content_name(bytes: &[u8], ext: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}.{ext}")
}

/// What the import produced: the bytes to store and the extension to store them under.
struct Processed {
    bytes: Vec<u8>,
    ext: &'static str,
}

/// Delay of one GIF frame in milliseconds. Browsers show a delay under 20 ms as 100 ms, and a zero delay would
/// put two frames at the same time, which the encoder refuses. The same rule applies here.
fn frame_delay_ms(frame: &image::Frame) -> i32 {
    let (numer, denom) = frame.delay().numer_denom_ms();
    let ms = (numer / denom.max(1)) as i32;
    if ms < 20 { 100 } else { ms }
}

/// Re-encodes a GIF as an animated WebP. Each frame keeps its own delay, so the timing matches the original.
/// Animated WebP is much smaller than GIF at the same visual quality.
/// `progress` is told how far encoding has got, from 0 to 1, once per frame. Decoding comes first and has no count to report.
fn process_gif(bytes: &[u8], mut progress: impl FnMut(f32)) -> Result<Processed, String> {
    let decoder = GifDecoder::new(Cursor::new(bytes)).map_err(|_| "The GIF could not be decoded.".to_string())?;
    let frames = decoder.into_frames().collect_frames().map_err(|_| "The GIF could not be decoded.".to_string())?;
    let first = frames.first().ok_or("The GIF has no frames.")?;
    let (width, height) = first.buffer().dimensions();

    let mut encoder = Encoder::new_with_options(
        (width, height),
        EncoderOptions {
            encoding_config: Some(EncodingConfig {
                encoding_type: EncodingType::Lossy(LossyEncodingConfig::default()),
                quality: WEBP_QUALITY,
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .map_err(|_| "The animation could not be encoded.".to_string())?;

    let total = frames.len() as f32;
    let mut timestamp: i32 = 0;
    for (index, frame) in frames.iter().enumerate() {
        encoder
            .add_frame(frame.buffer().as_raw(), timestamp)
            .map_err(|_| "The animation could not be encoded.".to_string())?;
        timestamp += frame_delay_ms(frame);
        // The last few percent are left for finalize, which writes the file out.
        progress((index + 1) as f32 / total * 0.95);
    }
    let data = encoder.finalize(timestamp).map_err(|_| "The animation could not be encoded.".to_string())?;
    progress(1.0);
    Ok(Processed { bytes: data.to_vec(), ext: "webp" })
}

/// Re-encodes a still image: orientation applied, longest side capped, metadata dropped by the re-encode.
/// Opaque images become JPEG, images with transparency stay PNG.
fn process_still(bytes: &[u8]) -> Result<Processed, String> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "The image could not be read.".to_string())?;
    let format = reader.format();
    let mut decoder = reader.into_decoder().map_err(|_| match format {
        Some(f) => format!("{} images are not supported yet. {SUPPORTED}", f.extensions_str().first().copied().unwrap_or("This format").to_uppercase()),
        None => format!("The image could not be decoded. {SUPPORTED}"),
    })?;
    let orientation = decoder.orientation().map_err(|e| e.to_string())?;
    let mut img = DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
    img.apply_orientation(orientation);

    if img.width() > MAX_SIDE || img.height() > MAX_SIDE {
        img = img.resize(MAX_SIDE, MAX_SIDE, FilterType::Lanczos3);
    }

    let mut out = Vec::new();
    if img.color().has_alpha() {
        img.write_to(&mut Cursor::new(&mut out), ImageFormat::Png).map_err(|e| e.to_string())?;
        Ok(Processed { bytes: out, ext: "png" })
    } else {
        let rgb = img.to_rgb8();
        JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
            .encode_image(&rgb)
            .map_err(|e| e.to_string())?;
        Ok(Processed { bytes: out, ext: "jpg" })
    }
}

/// Saves an image sent as base64 and returns its stored file name.
/// Any format the decoder understands is accepted. Still images are re-encoded to a smaller file.
/// An animated GIF is re-encoded as an animated WebP with its frame timing kept.
/// It runs off the main thread, because encoding a long GIF takes seconds and would freeze the window.
/// A GIF reports its encoding progress, 0 to 1, on `on_progress`. A still image is quick and reports nothing.
#[tauri::command(async)]
pub fn wallpaper_import(data_base64: String, on_progress: Channel<f32>) -> Result<String, String> {
    import_wallpaper(&data_base64, |fraction| {
        let _ = on_progress.send(fraction);
    })
}

/// The import behind `wallpaper_import`, with progress as a plain callback so it can run without Tauri.
fn import_wallpaper(data_base64: &str, progress: impl FnMut(f32)) -> Result<String, String> {
    let bytes = STANDARD.decode(data_base64).map_err(|_| "The image could not be read.".to_string())?;
    if bytes.is_empty() {
        return Err("The image is empty.".into());
    }

    let processed = match image::guess_format(&bytes) {
        Ok(ImageFormat::Gif) => process_gif(&bytes, progress)?,
        Ok(_) => process_still(&bytes)?,
        Err(_) => return Err(format!("This file is not an image the wallpaper can use. {SUPPORTED}")),
    };

    let name = content_name(&processed.bytes, processed.ext);
    let dir = wallpapers_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(&name), &processed.bytes).map_err(|e| e.to_string())?;
    Ok(name)
}

/// Absolute path of a stored wallpaper, for the webview to load through the asset protocol.
#[tauri::command]
pub fn wallpaper_path(name: String) -> Result<String, String> {
    if !is_safe_name(&name) {
        return Err("Unknown wallpaper.".into());
    }
    Ok(wallpapers_dir()?.join(name).to_string_lossy().into_owned())
}

/// Deletes a stored wallpaper. Missing files are not an error.
#[tauri::command]
pub fn wallpaper_remove(name: String) -> Result<(), String> {
    if !is_safe_name(&name) {
        return Err("Unknown wallpaper.".into());
    }
    match std::fs::remove_file(wallpapers_dir()?.join(name)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_plain_hex_names_with_image_extensions() {
        assert!(is_safe_name("3f9a1c2b.png"));
        assert!(is_safe_name("0123456789abcdef.webp"));
        assert!(!is_safe_name("../../etc/passwd"));
        assert!(!is_safe_name("3f9a1c2b.exe"));
        assert!(!is_safe_name("3F9A1C2B.png"));
        assert!(!is_safe_name("abc.png"));
    }

    #[test]
    fn a_still_is_reencoded_without_metadata_and_capped() {
        let mut png = Vec::new();
        let img = image::RgbImage::from_pixel(3000, 1000, image::Rgb([200, 40, 40]));
        DynamicImage::ImageRgb8(img).write_to(&mut Cursor::new(&mut png), ImageFormat::Png).unwrap();
        let processed = process_still(&png).unwrap();
        assert_eq!(processed.ext, "jpg");
        let back = image::load_from_memory(&processed.bytes).unwrap();
        assert_eq!(back.width(), MAX_SIDE);
    }

    #[test]
    fn a_transparent_still_stays_png() {
        let img = image::RgbaImage::from_pixel(20, 20, image::Rgba([0, 0, 0, 0]));
        let mut png = Vec::new();
        DynamicImage::ImageRgba8(img).write_to(&mut Cursor::new(&mut png), ImageFormat::Png).unwrap();
        assert_eq!(process_still(&png).unwrap().ext, "png");
    }

    fn gif_with_delays(delays_ms: &[u32]) -> Vec<u8> {
        let mut out = Vec::new();
        {
            let mut encoder = image::codecs::gif::GifEncoder::new(&mut out);
            for (i, ms) in delays_ms.iter().enumerate() {
                let shade = (i as u8).wrapping_mul(60);
                let buffer = image::RgbaImage::from_pixel(8, 8, image::Rgba([shade, 80, 120, 255]));
                let frame = image::Frame::from_parts(buffer, 0, 0, image::Delay::from_numer_denom_ms(*ms, 1));
                encoder.encode_frame(frame).unwrap();
            }
        }
        out
    }

    #[test]
    fn a_gif_becomes_an_animated_webp() {
        let processed = process_gif(&gif_with_delays(&[100, 200, 100]), |_| {}).unwrap();
        assert_eq!(processed.ext, "webp");
        assert!(processed.bytes.starts_with(b"RIFF"));
    }

    #[test]
    fn a_gif_with_zero_delay_frames_still_encodes() {
        // Zero-delay frames would otherwise share one timestamp and fail the whole import.
        let processed = process_gif(&gif_with_delays(&[0, 0, 0]), |_| {}).unwrap();
        assert_eq!(processed.ext, "webp");
    }

    #[test]
    fn a_gif_reports_rising_progress_that_ends_at_one() {
        let mut seen = Vec::new();
        process_gif(&gif_with_delays(&[100, 100, 100, 100]), |p| seen.push(p)).unwrap();
        assert_eq!(seen.len(), 5, "one report per frame, then one at the end");
        assert!(seen.windows(2).all(|pair| pair[0] < pair[1]));
        assert!(seen.iter().all(|p| (0.0..=1.0).contains(p)));
        assert_eq!(*seen.last().unwrap(), 1.0);
    }

    #[test]
    fn short_gif_delays_are_shown_as_100_ms() {
        let gif = gif_with_delays(&[0, 10, 20, 250]);
        let frames = GifDecoder::new(Cursor::new(gif)).unwrap().into_frames().collect_frames().unwrap();
        let delays: Vec<i32> = frames.iter().map(frame_delay_ms).collect();
        assert_eq!(delays, vec![100, 100, 20, 250]);
    }

    #[test]
    fn a_file_that_is_not_an_image_is_refused_with_the_supported_formats() {
        let error = import_wallpaper(&STANDARD.encode(b"not an image at all"), |_| {}).unwrap_err();
        assert!(error.contains("PNG, JPEG, WebP, GIF"));
    }

    #[test]
    fn content_name_is_stable_for_the_same_bytes() {
        assert_eq!(content_name(b"same", "png"), content_name(b"same", "png"));
        assert_ne!(content_name(b"one", "png"), content_name(b"two", "png"));
    }
}
