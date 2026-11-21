// The coach's body in 3D: a real person model (see characters.ts), loaded when the talk screen opens. Its face moves through
// the blend shapes of morphs.ts, and its head, neck and chest through their bones, each frame from the pose (rig.ts). The
// file is loaded only when the talk opens, so three.js is not part of the start-up of the app.
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CoachInfo } from './characters';
import { faceWeights } from './morphs';
import type { Pose } from './rig';

export interface CoachScene {
  render: (pose: Pose) => void;
  dispose: () => void;
}

/** A bone's name without the prefix some rigs add: 'Bip01 Head' is 'Head'. */
function boneName(object: THREE.Object3D): string {
  return object.name.replace(/^Bip01\s+/, '');
}

/** Loads the coach's model into `host`, and returns the way to draw it and to free it. */
export async function loadCoach(host: HTMLElement, coach: CoachInfo): Promise<CoachScene> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}${coach.file}`);
  const model = gltf.scene;

  const morphMeshes: THREE.Mesh[] = [];
  const bones: { head?: THREE.Object3D; neck?: THREE.Object3D; chest?: THREE.Object3D } = {};
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
    if ((object as THREE.Bone).isBone) {
      const name = boneName(object);
      if (name === 'Head') bones.head = object;
      else if (name === 'Neck') bones.neck = object;
      else if (name === 'Spine1') bones.chest = object;
    }
  });
  // The rest pose of each bone: every turn is applied on top of it.
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const bone of Object.values(bones)) {
    if (bone) rest.set(bone, bone.quaternion.clone());
  }

  // A model measured in centimetres is brought to metres.
  if (new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y > 10) model.scale.setScalar(0.01);
  model.updateMatrixWorld(true);

  // The coach is the head only. Everything below the base of the neck is cut away with a plane, so the body, the clothes and
  // the arms of the model are never drawn. The plane is applied to the materials once the renderer exists.
  // The base of the neck lies about 17 per cent of the figure's height below the top of the head. The bones of some rigs
  // are not placed where the skin is, so the measure comes from the bounds of the model.
  const figure = new THREE.Box3().setFromObject(model);
  const neckY = figure.min.y + (figure.max.y - figure.min.y) * 0.83;
  const cut = new THREE.Plane(new THREE.Vector3(0, 1, 0), -neckY);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.clippingPlanes = [cut];
  });

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(1.5, 2.5, 3);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-2, 1, 2);
  scene.add(key, fill, model);

  // The camera frames the head, from the top of the model down to the cut at the base of the neck.
  const bounds = new THREE.Box3().setFromObject(model);
  const head = Math.max(0.2, bounds.max.y - neckY);
  const focus = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, neckY + head * 0.55, (bounds.min.z + bounds.max.z) / 2);
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
  camera.position.set(focus.x, focus.y, focus.z + head * 3.4);
  camera.lookAt(focus.x, focus.y, focus.z);

  const resize = (): void => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const euler = new THREE.Euler();
  const delta = new THREE.Quaternion();
  const turn = (bone: THREE.Object3D | undefined, x: number, y: number, z: number): void => {
    const start = bone ? rest.get(bone) : undefined;
    if (!bone || !start) return;
    bone.quaternion.copy(start).multiply(delta.setFromEuler(euler.set(x, y, z)));
  };

  return {
    render(pose) {
      const weights = faceWeights({
        mouth: pose,
        blink: pose.blink,
        lift: pose.lift,
        smile: pose.smile,
        gazeX: pose.gazeX,
        gazeY: pose.gazeY,
      });
      for (const mesh of morphMeshes) {
        const dictionary = mesh.morphTargetDictionary ?? {};
        const influences = mesh.morphTargetInfluences ?? [];
        for (const [name, value] of Object.entries(weights)) {
          const index = dictionary[name];
          if (index !== undefined) influences[index] = value;
        }
      }
      turn(bones.head, pose.pitch, pose.yaw, pose.roll);
      turn(bones.neck, pose.pitch * 0.3, pose.yaw * 0.4, 0);
      turn(bones.chest, pose.breath * 0.012, 0, 0);
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      });
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
