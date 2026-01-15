'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { TextReveal } from '../ui/Animations';
import Link from 'next/link';

// Velocity tracking hook
function useScrollVelocity() {
    const velocity = useRef(0);
    const lastScroll = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY;
            velocity.current = (currentScroll - lastScroll.current) * 0.1;
            lastScroll.current = currentScroll;
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return velocity;
}

// 3D Floating Object with Jelly Distortion
function JellyMesh({ position = [0, 0, 0] as [number, number, number] }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const { pointer } = useThree();

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uSpeed: { value: 0 },
            uStrength: { value: 0.5 },
            uTexture: { value: null },
            uOpacity: { value: 1.0 },
        }),
        []
    );

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            // Smooth velocity decay
            materialRef.current.uniforms.uSpeed.value = THREE.MathUtils.lerp(
                materialRef.current.uniforms.uSpeed.value,
                Math.abs(pointer.x) + Math.abs(pointer.y),
                0.05
            );
        }

        if (meshRef.current) {
            // Rotate based on mouse
            meshRef.current.rotation.x = THREE.MathUtils.lerp(
                meshRef.current.rotation.x,
                pointer.y * 0.2,
                0.05
            );
            meshRef.current.rotation.y = THREE.MathUtils.lerp(
                meshRef.current.rotation.y,
                pointer.x * 0.3,
                0.05
            );
        }
    });

    return (
        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
            <mesh ref={meshRef} position={position} scale={3}>
                <icosahedronGeometry args={[1, 8]} />
                <meshStandardMaterial
                    color="#0071E3"
                    roughness={0.1}
                    metalness={0.9}
                    wireframe={false}
                />
            </mesh>
        </Float>
    );
}

// Floating Particles with RGB effect
function ParticleField({ count = 150 }) {
    const points = useRef<THREE.Points>(null);

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 30;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 30;

            // Gradient colors from blue to purple
            col[i * 3] = 0 + Math.random() * 0.3; // R
            col[i * 3 + 1] = 0.4 + Math.random() * 0.3; // G
            col[i * 3 + 2] = 0.9 + Math.random() * 0.1; // B
        }

        return [pos, col];
    }, [count]);

    useFrame((state) => {
        if (points.current) {
            points.current.rotation.y = state.clock.elapsedTime * 0.02;
            points.current.rotation.x = state.clock.elapsedTime * 0.01;
        }
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial
                size={0.05}
                vertexColors
                transparent
                opacity={0.8}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

// Main Scene - simplified without postprocessing to avoid alpha context errors
function Scene() {
    return (
        <>
            <color attach="background" args={['#0a0a0a']} />
            <fog attach="fog" args={['#0a0a0a', 10, 40]} />

            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
            <pointLight position={[-10, -10, -10]} color="#0071E3" intensity={2} />
            <pointLight position={[10, -5, 5]} color="#8B5CF6" intensity={1} />

            <JellyMesh />
            <ParticleField count={200} />

            <Environment preset="city" />
        </>
    );
}

export function HeroJelly() {
    return (
        <section className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0a]">
            {/* 3D Canvas */}
            <div className="absolute inset-0">
                <Canvas
                    camera={{ position: [0, 0, 10], fov: 50 }}
                    gl={{ antialias: true, alpha: true }}
                    dpr={[1, 2]}
                >
                    <Scene />
                </Canvas>
            </div>

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-transparent to-[#0a0a0a] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0071E3]/10 via-transparent to-[#8B5CF6]/10 pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className="text-center max-w-5xl"
                >
                    {/* Pre-title */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="text-sm md:text-base text-[#0071E3] font-medium tracking-widest uppercase mb-6"
                    >
                        Premium 3D Print Studio
                    </motion.p>

                    {/* Main Title */}
                    <h1 className="text-[clamp(48px,12vw,140px)] font-bold leading-[0.85] tracking-[-0.04em] text-white mb-8">
                        <TextReveal text="Sản Phẩm" delay={0.4} />
                        <br />
                        <span className="bg-gradient-to-r from-[#0071E3] via-[#00C7BE] to-[#8B5CF6] bg-clip-text text-transparent">
                            <TextReveal text="Độc Đáo" delay={0.7} />
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1 }}
                        className="text-lg md:text-xl text-white/50 mb-12 max-w-lg mx-auto"
                    >
                        Chế tác thủ công tỉ mỉ • Cá nhân hóa hoàn toàn • Chất lượng cao cấp
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.2 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link
                            href="/products"
                            className="group px-8 py-4 rounded-full bg-white text-[#0a0a0a] font-medium text-base hover:scale-105 transition-all flex items-center gap-2"
                            data-cursor
                            data-cursor-text="View"
                        >
                            Khám phá ngay
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                        <Link
                            href="/custom"
                            className="px-8 py-4 rounded-full border border-white/20 text-white font-medium text-base hover:bg-white/10 transition-all"
                            data-cursor
                            data-cursor-text="Custom"
                        >
                            Tạo riêng cho bạn
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        className="flex flex-col items-center gap-2 text-white/30"
                    >
                        <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
                        <div className="w-5 h-8 rounded-full border border-white/30 flex justify-center pt-2">
                            <motion.div
                                animate={{ y: [0, 8, 0], opacity: [1, 0, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                                className="w-1 h-1 rounded-full bg-white/50"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
