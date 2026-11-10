# Living Will Point Cloud

Interactive red anatomical point clouds with mouse attraction, anatomy labels, particle trails, and audio-driven breathing.

[Open the hosted experience](https://living-will-point-cloud.perkyeave8.chatgpt.site/)

## Open in GitHub Desktop

On this repository page, choose **Code → Open with GitHub Desktop**. If already cloned, choose **Fetch origin → Pull origin** in GitHub Desktop.

## Preview locally

Open the repository in Cursor or VS Code and use the Live Server extension to open `index.html`, or run this command in the repository directory:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser. Use an HTTP server so the point-cloud data and audio envelope can load.

## Controls

- Choose 01, 02, or 03 to switch models.
- Move the pointer over a model to gather nearby particles and reveal anatomical labels.
- Drag to rotate and scroll to zoom.
- Enable Ventilator to play the breathing audio and expand the particles with the sound.
- Disable Ventilator to let the expansion gradually settle.
- Reset view restores the camera.

Anatomical regions are approximate artistic annotations.
