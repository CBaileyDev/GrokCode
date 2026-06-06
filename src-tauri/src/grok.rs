//! Locating the `grok` CLI per-OS and constructing the command to launch it.
//!
//! On Windows, `grok` may be installed as `grok.exe`, a `grok.cmd` shim, or a
//! `grok.ps1` PowerShell script. The first two are launchable directly (or via
//! `cmd`), but a `.ps1` must be run through `powershell`. macOS/Linux always
//! resolve to a normal executable on `PATH`.

use portable_pty::CommandBuilder;
use std::path::Path;

/// Search `PATH` (and, on Windows, a few common install locations) for `grok`.
/// Returns the absolute path to the binary/shim, or `None` if nothing is found.
pub fn locate_grok() -> Option<String> {
    let candidates: &[&str] = if cfg!(windows) {
        &["grok", "grok.exe", "grok.cmd", "grok.ps1"]
    } else {
        &["grok"]
    };

    for name in candidates {
        if let Ok(path) = which::which(name) {
            return Some(path.to_string_lossy().into_owned());
        }
    }

    #[cfg(windows)]
    {
        if let Some(path) = probe_windows_install_dirs() {
            return Some(path);
        }
    }

    None
}

/// Validate a user-supplied path to the `grok` binary (manual override).
pub fn validate_grok(path: &str) -> bool {
    let p = Path::new(path);
    p.is_file()
}

/// Build the command that launches grok, wrapping shim formats as needed.
pub fn build_command(grok_path: &str) -> CommandBuilder {
    #[cfg(windows)]
    {
        let lower = grok_path.to_ascii_lowercase();
        if lower.ends_with(".ps1") {
            let mut cmd = CommandBuilder::new("powershell.exe");
            cmd.args([
                "-NoLogo",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                grok_path,
            ]);
            return cmd;
        }
        if lower.ends_with(".cmd") || lower.ends_with(".bat") {
            let mut cmd = CommandBuilder::new("cmd.exe");
            cmd.args(["/c", grok_path]);
            return cmd;
        }
    }

    CommandBuilder::new(grok_path)
}

/// Probe well-known install directories on Windows for a grok shim.
#[cfg(windows)]
fn probe_windows_install_dirs() -> Option<String> {
    let mut roots: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("USERPROFILE") {
        roots.push(Path::new(&home).join(".grok").join("bin"));
        roots.push(Path::new(&home).join(".local").join("bin"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(Path::new(&local).join("Programs").join("grok"));
    }

    let names = ["grok.exe", "grok.cmd", "grok.ps1"];
    for root in roots {
        for name in names {
            let candidate = root.join(name);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().into_owned());
            }
        }
    }
    None
}
