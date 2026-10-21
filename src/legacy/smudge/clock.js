// A tiny shared clock that the 3D scene updates every frame.
//
// The timeline is FRAME based (like the Orbit studio): playback counts frames,
// loops back to 0, and every effect is derived from `frame / fps` — so a given
// frame always renders exactly the same image. That is what makes an exact
// delivery possible (for example 6 fps, 12 frames, a 2.00 s loop).
//
// The timeline reads this to draw the playhead and to scrub; write a frame
// number into `seekFrame` and the scene jumps there on its next frame.
export const animClock = {
  frame: 0,        // current timeline frame (integer)
  total: 300,      // frames in the loop
  fps: 60,
  loop: true,      // wrap around at the end?
  t: 0,            // frame / fps, in seconds (used by the slider readouts)
  playing: true,
  hold: false,     // true while exporting: the frame does not advance
  seekFrame: null, // set to a number to jump the timeline there
  drawn: 0,        // how many frames the scene has actually rendered
}
