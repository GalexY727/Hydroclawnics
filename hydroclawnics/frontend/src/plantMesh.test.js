import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { createPlantMesh, getHealthColor } from './plantMesh'

describe('getHealthColor', () => {
  it('returns stage 0 base color for health > 0.7', () => {
    const c = getHealthColor(0, 0.9)
    expect(c.getHexString()).toBe('a8c5a0')
  })

  it('returns stage 1 base color for health > 0.7', () => {
    const c = getHealthColor(1, 0.9)
    expect(c.getHexString()).toBe('7ab87a')
  })

  it('shifts away from stage color for warning health (0.4–0.7)', () => {
    const base = getHealthColor(0, 0.9).getHexString()
    const warn = getHealthColor(0, 0.55).getHexString()
    expect(warn).not.toBe(base)
  })

  it('shifts away from stage color for critical health (< 0.4)', () => {
    const base = getHealthColor(0, 0.9).getHexString()
    const crit = getHealthColor(0, 0.2).getHexString()
    expect(crit).not.toBe(base)
  })

  it('returns near-gray for health === 0', () => {
    const c = getHealthColor(0, 0)
    expect(c.getHexString()).toBe('6b6b6b')
  })

  it('defaults to stage 1 color when stage is undefined', () => {
    const c = getHealthColor(undefined, 0.9)
    expect(c.getHexString()).toBe('7ab87a')
  })
})

describe('createPlantMesh', () => {
  it('returns a THREE.Group', () => {
    expect(createPlantMesh(0, 0.9)).toBeInstanceOf(THREE.Group)
  })

  it('stage 0: stem + 1 sphere = 2 meshes', () => {
    const g = createPlantMesh(0, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(2)
  })

  it('stage 1: stem + 2 leaves = 3 meshes', () => {
    const g = createPlantMesh(1, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(3)
  })

  it('stage 2: stem + 3 cones = 4 meshes', () => {
    const g = createPlantMesh(2, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(4)
  })

  it('stage 3: stem + 4 cluster spheres + canopy = 6 meshes', () => {
    const g = createPlantMesh(3, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(6)
  })

  it('defaults to stage 1, health 0.8 for undefined args', () => {
    const g = createPlantMesh(undefined, undefined)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(3) // same as stage 1
  })

  it('only foliage meshes have userData.isFoliage = true', () => {
    const g = createPlantMesh(0, 0.9)
    const foliage = g.children.filter(c => c instanceof THREE.Mesh && c.userData.isFoliage)
    const stem = g.children.filter(c => c instanceof THREE.Mesh && !c.userData.isFoliage)
    expect(foliage.length).toBe(1)
    expect(stem.length).toBe(1)
  })

  it('all meshes use MeshLambertMaterial', () => {
    const g = createPlantMesh(2, 0.55)
    g.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        expect(child.material).toBeInstanceOf(THREE.MeshLambertMaterial)
      }
    })
  })

  it('same stage+health returns same material instance (cache)', () => {
    const g1 = createPlantMesh(1, 0.9)
    const g2 = createPlantMesh(1, 0.9)
    const mat1 = g1.children.find(c => c instanceof THREE.Mesh).material
    const mat2 = g2.children.find(c => c instanceof THREE.Mesh).material
    expect(mat1).toBe(mat2)
  })

  it('stem position.y = 0.08 + stemH/2 for stage 0', () => {
    const g = createPlantMesh(0, 0.9)
    const stem = g.children.find(c => c instanceof THREE.Mesh && !c.userData.isFoliage)
    expect(stem.position.y).toBeCloseTo(0.08 + 0.3 / 2, 5)
  })

  it('stage 3: all 5 foliage meshes (4 cluster + canopy) have isFoliage=true', () => {
    const g = createPlantMesh(3, 0.9)
    const foliage = g.children.filter(c => c instanceof THREE.Mesh && c.userData.isFoliage)
    expect(foliage.length).toBe(5)
  })
})
