//! Pseudo-terminal session: spawns a shell, streams its output, accepts input and resizes.

use std::{
    io::{Read, Write},
    sync::mpsc::{self, Receiver},
    thread,
};

use anyhow::{Context as _, Result};
use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};

/// A running shell attached to a pseudo-terminal.
pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    output: Receiver<Vec<u8>>,
}

impl PtySession {
    /// Starts `shell` in a PTY of `rows` by `cols` cells.
    pub fn spawn(shell: &str, rows: u16, cols: u16) -> Result<Self> {
        let pair = native_pty_system()
            .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .context("openpty failed")?;

        let mut command = CommandBuilder::new(shell);
        command.env("TERM", "xterm-256color");
        let mut child = pair.slave.spawn_command(command).context("spawn shell failed")?;
        // The child owns the slave end now; dropping ours lets reads see EOF on exit.
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().context("clone reader failed")?;
        let writer = pair.master.take_writer().context("take writer failed")?;

        let (tx, output) = mpsc::channel();
        thread::Builder::new()
            .name("haya-pty-reader".into())
            .spawn(move || {
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            if tx.send(buf[..n].to_vec()).is_err() {
                                break;
                            }
                        }
                    }
                }
                let _ = child.wait();
            })
            .context("spawn reader thread failed")?;

        Ok(Self { master: pair.master, writer, output })
    }

    /// Writes raw bytes (keystrokes, paste) to the shell.
    pub fn write(&mut self, bytes: &[u8]) -> Result<()> {
        self.writer.write_all(bytes).context("write to pty failed")?;
        self.writer.flush().context("flush pty failed")
    }

    /// Resizes the pseudo-terminal; the shell receives SIGWINCH.
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        self.master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .context("resize pty failed")
    }

    /// Returns every chunk of output received since the last call, without blocking.
    pub fn drain_output(&self) -> Vec<Vec<u8>> {
        self.output.try_iter().collect()
    }
}
