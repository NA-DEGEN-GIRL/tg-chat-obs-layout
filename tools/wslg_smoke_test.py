#!/usr/bin/env python3
import os
import time
import tkinter as tk


def main() -> None:
    root = tk.Tk()
    root.title("WSLg smoke test")
    root.geometry(os.environ.get("WSLG_PROBE_GEOMETRY", "520x280+120+120"))
    root.attributes("-topmost", True)
    root.after(1200, lambda: root.attributes("-topmost", False))

    now = time.strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "WSLg smoke test",
        "",
        f"Started: {now}",
        f"DISPLAY={os.environ.get('DISPLAY', '')}",
        f"WAYLAND_DISPLAY={os.environ.get('WAYLAND_DISPLAY', '')}",
        f"XDG_RUNTIME_DIR={os.environ.get('XDG_RUNTIME_DIR', '')}",
        "",
        "If this window is visible, WSLg can show a normal GUI window.",
        "Close this window to finish the test.",
    ]

    frame = tk.Frame(root, bg="#111827", padx=24, pady=22)
    frame.pack(fill="both", expand=True)

    label = tk.Label(
        frame,
        text="\n".join(lines),
        justify="left",
        anchor="w",
        fg="#f9fafb",
        bg="#111827",
        font=("TkDefaultFont", 12),
    )
    label.pack(fill="both", expand=True)

    button = tk.Button(frame, text="Close", command=root.destroy)
    button.pack(anchor="e")

    root.lift()
    root.focus_force()
    root.mainloop()


if __name__ == "__main__":
    main()
