# Credits for the coaches

The coaches of the talk screen are real person models, converted for the app. Each model is used under the license named
below. The models show the same people as their sources; only their file format and size were changed (see each section).

## Ana: MakeHuman (CC0)

Ana is made with MakeHuman and its Blender plugin, MPFB (MakeHuman Plugin for Blender). The body, the face and the core
assets are shared under the CC0 dedication to the public domain: <https://creativecommons.org/publicdomain/zero/1.0/>.
Some clothing and hair assets made by the community may be under CC-BY; they are credited here as well. MakeHuman
licensing: <https://static.makehumancommunity.org/about/license.html>.

- Source: the MPFB model that the TalkingHead project ships as `avatars/mpfb.glb`
  (<https://github.com/met4citizen/TalkingHead>).
- Changes: the textures were converted to WebP and the file was compressed with meshopt. Every blend shape was kept.

## Leo: Microsoft RocketBox (MIT)

Leo is the adult male avatar `Male_Adult_02` of the Microsoft RocketBox avatar library
(<https://github.com/microsoft/Microsoft-Rocketbox>), licensed under the MIT License printed at the end of this file.

- Changes: converted from the FBX file in Blender (`scripts/characters/convert-rocketbox.py`). Only the ARKit face shapes
  and the Oculus visemes were kept, under their standard names. The textures were converted to WebP and the file was
  compressed with meshopt.

## Mia: Microsoft RocketBox (MIT)

Mia is the adult female avatar `Female_Adult_15` of the same library, under the same MIT License. The changes are the same
as for Leo.

## The MIT License of the RocketBox library

MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
