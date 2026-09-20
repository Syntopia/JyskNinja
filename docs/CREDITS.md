# Jysk Ninja — credits and licenses

## Software and derived assets

Full notices are included with the distribution; retain them when redistributing the relevant components.

| Component | Credit and license |
| --- | --- |
| Three.js and bundled addons | © 2010–2025 three.js authors; [MIT](vendor/three/LICENSE). |
| meshoptimizer decoder | © 2016–2026 Arseny Kapoulkine; [MIT](vendor/meshopt/LICENSE.md). |
| SMAA shaders and lookup textures | Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro and Diego Gutierrez; [SMAA license](licenses/SMAA.txt). Bundled through Three.js. |
| LTC area-light lookup data | Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt; [license](licenses/LTC.txt). Reference: *Real-Time Polygonal-Light Shading with Linearly Transformed Cosines*, ACM Transactions on Graphics 35(4), SIGGRAPH 2016 ([project](https://eheitzresearch.wordpress.com/415-2/)). Bundled through Three.js. |
| Original hero's face topology | Google / MediaPipe authors; [Apache-2.0](MediaPipe_LICENSE.txt). Derived from the [canonical face model](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj). Modified for this project: face reshaped from supplied portrait landmarks, textured, incorporated into a custom rigged character and compressed in `assets/web/ninja-game.glb`. |
| Yuji Boku menu font | © 2021 The Yuji Project Authors; [SIL OFL 1.1](assets/fonts/OFL.txt). Modified by subsetting to the menu glyphs; distributed as `YujiBoku-Menu.ttf`. |
| Retargeted character animations | Quaternius, [Universal Animation Library — Standard](https://quaternius.itch.io/universal-animation-library); [CC0 notice](ANIMATION_LICENSE.txt). Motions retargeted and adapted to the game's rigs. |
| Recorded combat foley | Iwan “qubodup” Gabovitch, StarNinjas and Independent.nu; CC0. [Original sources and edits](assets/audio/combat/CREDITS.md). |

## Creation tools and generated art

Game code and procedural effects were developed with Codex. Environments and original character work were made in Blender; concept art and textures used OpenAI image generation. These are creation tools, not bundled application runtimes. Blender's GPL does not apply to exported artwork ([Blender license](https://www.blender.org/about/license/)); OpenAI output remains subject to its [terms](https://openai.com/policies/eu-terms-of-use/) and rights in any supplied references.

The carpenter, female worker, warlord, samurai and masked ninja were generated/rigged through [kirikir13/image-to-rigged-3d](https://huggingface.co/spaces/kirikir13/image-to-rigged-3d), then edited or retargeted in the project. The service identifies Microsoft TRELLIS.2 and VAST-AI SkinTokens/TokenRig as MIT-licensed models. Its preprocessing uses [BRIA RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0), whose public model license is CC BY-NC 4.0. This credits the generation pipeline, not an MIT license grant for all generated artwork. No generation model weights are shipped. Assets were packaged with glTF Transform, meshoptimizer and Sharp/WebP; only the meshoptimizer decoder is part of the browser runtime. Commercial use of that preprocessing workflow needs separate review.

## Music — Suno

The creator supplied these unchanged MP3s, generated on Suno's **free plan**:

- “影の刃” — `assets/audio/kage-no-yaiba.mp3`
- “凍戦の鼓動” — `assets/audio/tosen-no-kodo.mp3`
- “影の鼓動” — `assets/audio/kage-no-kodo.mp3`

Credit: music created with [Suno](https://suno.com). Free-plan output is restricted to personal, non-commercial use; Suno expressly permits personal non-monetizing projects. Use must follow the applicable [terms](https://suno.com/terms), including permitted download channels. This repository does not grant independent reuse rights to these recordings. [Free-plan guidance](https://help.suno.com/en/articles/9601601).

## Announcer voices — Qwen3-TTS

“Arm Chop”, “Head Chop”, “Victory” and “Defeated” use an original synthetic voice designed with [Qwen3-TTS VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) and synthesized with [Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base) through the official Qwen Hugging Face Space. The creator selected the natural second takes; no pitch shift or slowdown is applied. No third-party voice recording was uploaded or cloned. [Generation provenance](assets/audio/announcer/provenance.json). The same original synthetic speaker introduces all five levels during loading; [level scripts and generation details](assets/audio/announcer/level-provenance.json).

Both generation models use Apache-2.0; no model weights or inference code are shipped. That license covers the models/code, not an automatic Apache license grant for generated audio. These recordings replace the earlier ElevenLabs clips in this distribution.

## Scope

Reviewed against the shipped game and available provenance on 20 September 2026. This is a personal non-commercial project. The free-plan Suno music must not be treated as commercially licensed or as CC0/MIT content. Rights in supplied images, likenesses, voices and other inputs must also be respected. Tool and component licenses do not establish rights in every input or provide a legal clearance of the entire game.
