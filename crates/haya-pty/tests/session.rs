//! Dropping a session must end its shell. Before the fix, the shell lived on after pty_close.

use std::{thread, time::Duration};

use haya_pty::PtySession;

/// True while a process with this pid exists and is not reaped.
fn alive(pid: u32) -> bool {
    // SAFETY: signal 0 only checks that the pid exists.
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
}

fn assert_dropping_ends_shell(shell: &str) {
    let session = PtySession::spawn(shell, 24, 80).expect("spawn");
    let pid = session.pid().expect("pid");
    assert!(alive(pid), "{shell} should be running after spawn");

    drop(session);

    // Drop waits for the child, so the pid should already be gone. Allow a short grace period anyway.
    for _ in 0..40 {
        if !alive(pid) {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
    panic!("{shell} {pid} is still alive after the session was dropped");
}

#[test]
fn dropping_a_session_ends_its_shell() {
    assert_dropping_ends_shell("/bin/sh");
}

#[test]
fn dropping_a_zsh_session_ends_it() {
    assert_dropping_ends_shell("/bin/zsh");
}
