"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

type MotionPreference = "system" | "on" | "off";

interface MotionContextValue {
    preference: MotionPreference;
    motionEnabled: boolean;
    prefersReducedMotion: boolean;
    setPreference: (value: MotionPreference) => void;
    toggleMotion: () => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

const STORAGE_KEY = "motion-preference";

function getSystemPrefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
    const [preference, setPreference] = useState<MotionPreference>("system");
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const stored = typeof window !== "undefined"
            ? (localStorage.getItem(STORAGE_KEY) as MotionPreference | null)
            : null;
        if (stored === "on" || stored === "off" || stored === "system") {
            setPreference(stored);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setPrefersReducedMotion(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const setPreferenceSafe = useCallback((value: MotionPreference) => {
        setPreference(value);
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, value);
        }
    }, []);

    const toggleMotion = useCallback(() => {
        setPreferenceSafe(preference === "off" ? "on" : "off");
    }, [preference, setPreferenceSafe]);

    const motionEnabled = useMemo(() => {
        if (preference === "on") return true;
        if (preference === "off") return false;
        return !prefersReducedMotion;
    }, [preference, prefersReducedMotion]);

    const value = useMemo<MotionContextValue>(() => ({
        preference,
        motionEnabled,
        prefersReducedMotion,
        setPreference: setPreferenceSafe,
        toggleMotion,
    }), [preference, motionEnabled, prefersReducedMotion, setPreferenceSafe, toggleMotion]);

    return (
        <MotionContext.Provider value={value}>
            {children}
        </MotionContext.Provider>
    );
}

export function useMotionPreference() {
    const ctx = useContext(MotionContext);
    if (!ctx) {
        throw new Error("useMotionPreference must be used within MotionPreferenceProvider");
    }
    return ctx;
}

