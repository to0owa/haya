//! Runs `haya-db` futures on a Tokio runtime and delivers results back to a GPUI entity.

use std::{future::Future, sync::OnceLock};

use anyhow::Result;
use gpui_kit::*;
use tokio::runtime::Runtime;

fn runtime() -> &'static Runtime {
    static RUNTIME: OnceLock<Runtime> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("tokio runtime")
    })
}

/// Runs `future` off the UI thread, then calls `done` on the UI thread with its result.
pub fn run<E, T, F>(
    cx: &mut Context<E>,
    future: F,
    done: impl FnOnce(&mut E, Result<T>, &mut Context<E>) + 'static,
) where
    E: 'static,
    T: Send + 'static,
    F: Future<Output = Result<T>> + Send + 'static,
{
    cx.spawn(async move |this, cx| {
        let result = cx
            .background_executor()
            .spawn(async move { runtime().block_on(future) })
            .await;
        let _ = this.update(cx, |view, cx| done(view, result, cx));
    })
    .detach();
}
