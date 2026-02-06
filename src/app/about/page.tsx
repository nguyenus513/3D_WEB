'use client';

import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useContent } from '@/hooks/useContent';

interface HeaderBlockData {
    kicker?: string;
    title?: string;
    subtitle?: string;
}

interface StoryBlockData {
    title?: string;
    paragraphs?: string[];
    imageEmoji?: string;
}

interface StatsBlockData {
    items?: { value: string; label: string }[];
}

interface ContactBlockData {
    title?: string;
    items?: { icon: string; label: string; value: string }[];
    socialTitle?: string;
    socials?: { name: string; url: string; icon: string }[];
}

interface FormBlockData {
    title?: string;
    fields?: {
        name?: string;
        phone?: string;
        email?: string;
        message?: string;
    };
    placeholders?: {
        name?: string;
        phone?: string;
        email?: string;
        message?: string;
    };
    submitLabel?: string;
}

interface MapBlockData {
    emoji?: string;
    note?: string;
}

export default function AboutPage() {
    const { getBlock } = useContent('about');

    const header = (getBlock('header')?.data ?? {}) as HeaderBlockData;
    const story = (getBlock('story')?.data ?? {}) as StoryBlockData;
    const stats = (getBlock('stats')?.data ?? {}) as StatsBlockData;
    const contact = (getBlock('contact')?.data ?? {}) as ContactBlockData;
    const form = (getBlock('form')?.data ?? {}) as FormBlockData;
    const map = (getBlock('map')?.data ?? {}) as MapBlockData;

    const statsItems = stats.items || [];
    const contactItems = contact.items || [];
    const socialLinks = contact.socials || [];

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-16">
                    <span className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4 block">
                        {header.kicker}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6">
                        {header.title}
                    </h1>
                    <p className="text-xl text-white/50 max-w-2xl mx-auto">
                        {header.subtitle}
                    </p>
                </AnimatedSection>

                {/* Story Section */}
                <AnimatedSection delay={0.1} className="mb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-6">
                                {story.title}
                            </h2>
                            <div className="space-y-4 text-white/60 leading-relaxed">
                                {(story.paragraphs || []).map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                        <div className="aspect-video bg-[#1D1D1F] rounded-3xl flex items-center justify-center">
                            <span className="text-8xl">{story.imageEmoji}</span>
                        </div>
                    </div>
                </AnimatedSection>

                {/* Stats */}
                <AnimatedSection delay={0.2} className="mb-20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {statsItems.map((stat, index) => (
                            <motion.div
                                key={`${stat.label}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className="bg-[#1D1D1F] rounded-2xl p-6 text-center"
                            >
                                <p className="text-3xl md:text-4xl font-bold text-white/70">{stat.value}</p>
                                <p className="text-white/60 mt-2">{stat.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Contact Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <AnimatedSection delay={0.3}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-10 h-full">
                            <h2 className="text-2xl font-bold text-white mb-8">
                                {contact.title}
                            </h2>

                            <div className="space-y-6 mb-8">
                                {contactItems.map((info, index) => (
                                    <div key={`${info.label}-${index}`} className="flex items-start gap-4">
                                        <span className="text-2xl">{info.icon}</span>
                                        <div>
                                            <p className="text-white/50 text-sm">{info.label}</p>
                                            <p className="text-white font-medium">{info.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Social Links */}
                            <h3 className="text-white font-medium mb-4">{contact.socialTitle}</h3>
                            <div className="flex gap-3">
                                {socialLinks.map((social) => (
                                    <a
                                        key={social.name}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-[#2D2D2F] flex items-center justify-center text-xl hover:bg-white text-black transition-colors"
                                        data-cursor
                                    >
                                        {social.icon}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Contact Form */}
                    <AnimatedSection delay={0.4}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold text-white mb-8">
                                {form.title}
                            </h2>

                            <form className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input placeholder={form.placeholders?.name || ''} aria-label={form.fields?.name} />
                                    <Input placeholder={form.placeholders?.phone || ''} aria-label={form.fields?.phone} />
                                </div>
                                <Input placeholder={form.placeholders?.email || ''} type="email" aria-label={form.fields?.email} />
                                <textarea
                                    placeholder={form.placeholders?.message || ''}
                                    className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/5"
                                    rows={5}
                                    aria-label={form.fields?.message}
                                />
                                <Button variant="primary" size="lg" className="w-full">
                                    {form.submitLabel}
                                </Button>
                            </form>
                        </div>
                    </AnimatedSection>
                </div>

                {/* Map Placeholder */}
                <AnimatedSection delay={0.5} className="mt-12">
                    <div className="bg-[#1D1D1F] rounded-3xl h-[300px] flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-5xl mb-4 block">{map.emoji}</span>
                            <p className="text-white/50">{map.note}</p>
                        </div>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
