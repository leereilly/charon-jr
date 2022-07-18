import { Camera } from '@/renderer/camera';
import { EnhancedDOMPoint } from '@/core/enhanced-dom-point';
import { Face } from '@/physics/face';
import { controls } from '@/core/controls';
import { Mesh } from '@/renderer/mesh';
import { textureLoader } from '@/renderer/texture-loader';
import { drawVolcanicRock } from '@/texture-creation/texture-maker';
import { CubeGeometry } from '@/cube-geometry';
import { Material } from '@/renderer/material';
import { findFloorHeightAtPosition, findWallCollisionsFromList } from '@/physics/surface-collision';

export class ThirdPersonPlayer {
  isJumping = false;
  feetCenter = new EnhancedDOMPoint(0, 0, 0);
  velocity = new EnhancedDOMPoint(0, 0, 0);
  angle = 0;

  mesh: Mesh;
  camera: Camera;
  idealPosition = new EnhancedDOMPoint(0, 3, -17);
  idealLookAt = new EnhancedDOMPoint(0, 2, 0);

  constructor(camera: Camera) {
    textureLoader.load(drawVolcanicRock())
    this.mesh = new Mesh(
      new CubeGeometry(0.3, 1, 0.3),
      new Material({color: '#f0f'})
    );
    this.feetCenter.y = 10;
    this.camera = camera;
  }

  private transformIdeal(ideal: EnhancedDOMPoint): EnhancedDOMPoint {
    return new EnhancedDOMPoint()
      .set(this.mesh.rotationMatrix.transformPoint(ideal))
      .add(this.mesh.position);
  }

  update(groupedFaces: { floorFaces: Face[]; wallFaces: Face[] }) {
    this.updateVelocityFromControls();
    this.velocity.y -= 0.003; // gravity
    this.feetCenter.add(this.velocity);
    this.collideWithLevel(groupedFaces);

    this.mesh.position.set(this.feetCenter);
    this.mesh.position.y += 0.5; // move up by half height so mesh ends at feet position

    this.camera.position.lerp(this.transformIdeal(this.idealPosition), 0.01);

    // Keep camera away regardless of lerp
    const distanceToKeep = 17;
    const normalizedPosition = this.camera.position.clone().subtract(this.mesh.position).normalize().scale(distanceToKeep);
    this.camera.position.x = normalizedPosition.x + this.mesh.position.x;
    this.camera.position.z = normalizedPosition.z + this.mesh.position.z;

    this.camera.lookAt(this.transformIdeal(this.idealLookAt));
    this.camera.updateWorldMatrix();
  }

  collideWithLevel(groupedFaces: {floorFaces: Face[], wallFaces: Face[]}) {
    const wallCollisions = findWallCollisionsFromList(groupedFaces.wallFaces, this.feetCenter, 0.4, 0.1);
    this.feetCenter.x += wallCollisions.xPush;
    this.feetCenter.z += wallCollisions.zPush;

    const floorData = findFloorHeightAtPosition(groupedFaces!.floorFaces, this.feetCenter);
    if (!floorData) {
      return;
    }

    const collisionDepth = floorData.height - this.feetCenter.y;

    if (collisionDepth > 0) {
      this.feetCenter.y += collisionDepth;
      this.velocity.y = 0;
      this.isJumping = false;
    }
  }

  protected updateVelocityFromControls() {
    const speed = 0.1;

    const mag = controls.direction.magnitude;
    const inputAngle = Math.atan2(-controls.direction.x, -controls.direction.z);
    const playerCameraDiff = this.mesh.position.clone().subtract(this.camera.position);
    const playerCameraAngle = Math.atan2(playerCameraDiff.x, playerCameraDiff.z);

    if (controls.direction.x !== 0 || controls.direction.z !== 0) {
      this.angle = inputAngle + playerCameraAngle;
    }

    this.velocity.z = Math.cos(this.angle) * mag * speed;
    this.velocity.x = Math.sin(this.angle) * mag * speed;

    this.mesh.setRotation(0, this.angle, 0);

    if (controls.isSpace || controls.isJumpPressed) {
      if (!this.isJumping) {
        this.velocity.y = 0.15;
        this.isJumping = true;
      }
    }
  }
}
