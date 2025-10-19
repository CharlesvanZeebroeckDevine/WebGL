# Interactive Audio-Visual Editor: Complete Technical Specification

## Project Description

Browser-based interactive audio-visual editor that enables users to create, manipulate, and visualize electronic music in real-time using professionally sampled instruments and fragment shader-driven visuals. The application combines three core instruments (Lead Synth, Bass Synth, Drum Machine) (with audio-reactive fragment shaders from Shadertoy (to implement later)).

Global time speed (time)
time = iTime
Overall speed of animation
BPM can stretch/compress time
Faster tempo = faster wave motion



### Core Features

- **Three Professional Instruments**: Lead synth, bass synth, and drum machine with 128+ GM instrument presets via smplr library, 

Electric piano : TX81Z
DrumMachine : TR-808
Mellotron, MK2 Brass, instrument: instruments[21]z

- **Pattern Sequencing**: Built-in rhythm presets (house, techno, synthwave) with step sequencer interface

- **Real-time Controls**: BPM, swing, per-instrument parameters, global effects (reverb, delay, filter)

- **Adding a choir**: Global parameter to add a choir. 

In the instrument Mellotron it's the number 5, and it should be on a low octave 48-71 so : 

const choir = new Mellotron(new AudioContext(), {
  instrument: instruments[4],
});

Later in the process we will connect these instruments to audio reactive shaders. 

1st : Set up three.js scene, connect tracks, we want to have 3 output to control our visuals, one for each melody, because the Piano and the Bassline have the same melody we will group them together as one audio output, we also need to output from Poly and Drums. 

2nd : Parse the audio to be able to be used inside our three.js scene, console log the values that it gives us using WebAudio, 

3rd : add an audio reactive square based on the values we get in the console. scale based on the melody1 (piano), rotate based on melody2 (Poly), offset position based on melody3 (Drums). 


xoff, yoff multipliers (0.1, 0.2)
sin(time + y*0.2)*0.1, sin(time*1.1 + x*0.3)*0.2
Grid wobble / wave motion
Feels like breathing or pulsating to beats
Drums (melody3) → bigger wobble

Base pointSize (15.0)
float pointSize = 15.0 + soff;
Overall scale of squares
Beat-based pulses feel natural
Poly (melody2) → increase size

soff multiplier (* 5.0)
soff = sin(time*1.2 + x*y*0.02)*5.0
Point jitter / size variability
Energy level can enlarge or tighten movement
Leads (melody1) energy controls jitter factor

Hue modulation (*0.1, *0.05)
hue = u*0.1 + sin(time*1.3 + v*20.0)*0.05
Color spectrum drift
Value (brightness) modulation (*0.5+0.5)
val = sin(time*1.4 + v*u*20.0)*0.5+0.5
Brightness / glow intensity
Global amplitude controls brightness and hue

