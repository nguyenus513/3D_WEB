'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, X, MessageCircle } from 'lucide-react';

// Contact info
const CONTACTS = {
    zalo: 'https://zalo.me/0123456789',
    instagram: 'https://instagram.com/miniver.3d',
    phone: 'tel:0123456789',
    hotline: '0123 456 789',
    email: 'hello@miniver.lab',
};

// Flat SVG Icons
const ZaloIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.06-.16-.04-.23-.02-.09.02-1.57 1-4.43 2.93-.42.29-.8.43-1.14.42-.37-.01-1.09-.21-1.63-.38-.66-.22-1.18-.33-1.13-.7.02-.19.27-.39.75-.59 2.93-1.27 4.89-2.11 5.88-2.52 2.8-1.16 3.38-1.36 3.76-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
    </svg>
);

const InstagramIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
);

const PhoneIcon = () => <Phone size={20} strokeWidth={2} />;

const EmailIcon = () => <Mail size={20} strokeWidth={2} />;

const contactItems = [
    { key: 'zalo', href: CONTACTS.zalo, icon: ZaloIcon, label: 'Zalo', external: true },
    { key: 'instagram', href: CONTACTS.instagram, icon: InstagramIcon, label: 'Instagram', external: true },
    { key: 'phone', href: CONTACTS.phone, icon: PhoneIcon, label: CONTACTS.hotline, external: false },
    { key: 'email', href: `mailto:${CONTACTS.email}`, icon: EmailIcon, label: 'Email', external: false },
];

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            staggerDirection: -1, // Bottom to top
        }
    },
    exit: {
        opacity: 0,
        transition: {
            staggerChildren: 0.05,
            staggerDirection: 1,
        }
    }
};

const itemVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        scale: 0.8
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring" as const,
            stiffness: 500,
            damping: 25,
        }
    },
    exit: {
        opacity: 0,
        y: 10,
        scale: 0.9,
        transition: { duration: 0.15 }
    }
};

export default function ContactWidget() {
    const [isOpen, setIsOpen] = useState(false);

    const glassStyle = "bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-lg hover:bg-white/20 transition-colors";

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Contact buttons */}
            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        className="flex flex-col items-end gap-3"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {contactItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <motion.a
                                    key={item.key}
                                    href={item.href}
                                    target={item.external ? "_blank" : undefined}
                                    rel={item.external ? "noopener noreferrer" : undefined}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.05, x: -5 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full ${glassStyle}`}
                                >
                                    <IconComponent />
                                    <span className="text-sm font-medium">{item.label}</span>
                                </motion.a>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main toggle button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`w-14 h-14 rounded-full flex items-center justify-center ${isOpen
                    ? 'bg-white/20 backdrop-blur-xl border border-white/20'
                    : 'bg-white/10 backdrop-blur-xl border border-white/20'
                    }`}
            >
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    {isOpen ? (
                        <X size={24} className="text-white" strokeWidth={2} />
                    ) : (
                        <MessageCircle size={24} className="text-white" strokeWidth={2} />
                    )}
                </motion.div>
            </motion.button>
        </div>
    );
}
