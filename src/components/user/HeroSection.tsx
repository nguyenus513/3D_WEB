'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Environment, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { TextReveal, Magnetic } from '../ui/Animations';
import Link from 'next/link';

// 3D Floating Sphere that follows mouse
function FloatingSphere() {
    const meshRef = useRef<THREE.Mesh>(null);
    const { viewport, pointer } = useThree();

    useFrame(() => {
        if (meshRef.current) {
            // Smooth follow mouse
            meshRef.current.rotation.x = THREE.MathUtils.lerp(
                meshRef.current.rotation.x,
                pointer.y * 0.3,
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
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={meshRef} scale={2.5}>
                <icosahedronGeometry args={[1, 4]} />
                <MeshDistortMaterial
                    color="#0071E3"
                    attach="material"
                    distort={0.4}
                    speed={3}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>
        </Float>
    );
}

// Floating particles
function Particles({ count = 100 }) {
    const mesh = useRef<THREE.Points>(null);

    const particles = useMemo(() => {
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        }
        return positions;
    }, [count]);

    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.y = state.clock.elapsedTime * 0.02;
            mesh.current.rotation.x = state.clock.elapsedTime * 0.01;
        }
    });

    return (
        <points ref={mesh}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[particles, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.02}
                color="#ffffff"
                transparent
                opacity={0.6}
                sizeAttenuation
            />
        </points>
    );
}

// Scene with all 3D elements
function Scene() {
    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -10]} color="#0071E3" intensity={0.5} />
            <FloatingSphere />
            <Particles count={200} />
            <Environment preset="city" />
        </>
    );
}

export function HeroSection() {
    return (
        <section className="relative min-h-screen w-full overflow-hidden bg-black">
            {/* 3D Canvas - Background */}
            <div className="absolute inset-0">
                <Canvas
                    camera={{ position: [0, 0, 8], fov: 45 }}
                    gl={{ antialias: true, alpha: true }}
                >
                    <Scene />
                </Canvas>
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black pointer-events-none" />

            {/* Content Overlay */}
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
                {/* Main Headline */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="text-center max-w-4xl"
                >
                    <h1 className="text-[clamp(40px,10vw,120px)] font-bold leading-[0.9] tracking-[-0.03em] text-white mb-8">
                        <TextReveal text="Sản Phẩm 3D" delay={0.2} />
                        <br />
                        <span className="text-[#0071E3]">
                            <TextReveal text="Độc Đáo" delay={0.5} />
                        </span>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1 }}
                        className="text-xl md:text-2xl text-white/60 mb-12 max-w-xl mx-auto"
                    >
                        Chế tác thủ công • Cá nhân hóa hoàn toàn
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.2 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Magnetic>
                            <Link
                                href="/products"
                                className="px-8 py-4 rounded-full bg-[#0071E3] text-white font-medium text-lg hover:scale-105 transition-transform"
                                data-cursor
                                data-cursor-text="View"
                            >
                                Khám phá ngay
                            </Link>
                        </Magnetic>
                        <Magnetic>
                            <Link
                                href="/custom"
                                className="px-8 py-4 rounded-full border border-white/30 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                                data-cursor
                                data-cursor-text="Custom"
                            >
                                Tạo riêng cho bạn
                            </Link>
                        </Magnetic>
                    </motion.div>
                </motion.div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="absolute bottom-12 left-1/2 -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="flex flex-col items-center gap-2 text-white/40"
                    >
                        <span className="text-xs uppercase tracking-widest">Scroll</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
