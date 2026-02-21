/**
 * Ground — minimal reference plane.
 * Just enough grid to give spatial context. Nothing decorative.
 */
export function Ground() {
  return (
    <group position={[0, -2.5, 0]}>
      {/* Single grid — spatial reference only */}
      <gridHelper args={[30, 30, '#00ff8818', '#111']} />

      {/* Subtle ground plane for shadow catching */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#080808" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}
