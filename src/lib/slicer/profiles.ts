import path from 'path';
import type { PrintMode, SliceJobParams } from './types';

export interface BuildVolume {
    x: number;
    y: number;
    z: number;
}

export interface ProfileDefinition {
    id: string;
    mode: PrintMode;
    label: string;
    printerName: string;
    iniPath: string;
    defaultLayerHeight: number;
    defaultInfill: number;
    densityGPerCm3: number;
    buildVolumeMm: BuildVolume;
    exposureTimeSeconds?: number;
    liftTimeSeconds?: number;
}

const PROFILES_DIR = path.join(process.cwd(), 'printer-profiles');

const FDM_BUILD_VOLUME: BuildVolume = { x: 256, y: 256, z: 256 };
const RESIN_BUILD_VOLUME: BuildVolume = { x: 153.36, y: 77.76, z: 165 };

const FDM_PROFILES: ProfileDefinition[] = [
    {
        id: 'fdm_pla_standard',
        mode: 'fdm',
        label: 'FDM – PLA Standard',
        printerName: 'Bambu Lab A1',
        iniPath: path.join(PROFILES_DIR, 'fdm', 'fdm_pla_standard.ini'),
        defaultLayerHeight: 0.2,
        defaultInfill: 20,
        densityGPerCm3: 1.24,
        buildVolumeMm: FDM_BUILD_VOLUME,
    },
    {
        id: 'fdm_petg_standard',
        mode: 'fdm',
        label: 'FDM – PETG Standard',
        printerName: 'Bambu Lab A1',
        iniPath: path.join(PROFILES_DIR, 'fdm', 'fdm_petg_standard.ini'),
        defaultLayerHeight: 0.2,
        defaultInfill: 20,
        densityGPerCm3: 1.27,
        buildVolumeMm: FDM_BUILD_VOLUME,
    },
];

const RESIN_PROFILES: ProfileDefinition[] = [
    {
        id: 'resin_standard_detail',
        mode: 'resin',
        label: 'Resin – Standard Detail (0.05 mm)',
        printerName: 'ELEGOO Mars 5 Ultra',
        iniPath: path.join(PROFILES_DIR, 'resin', 'resin_standard_detail.ini'),
        defaultLayerHeight: 0.05,
        defaultInfill: 100,
        densityGPerCm3: 1.1,
        buildVolumeMm: RESIN_BUILD_VOLUME,
        exposureTimeSeconds: 2.5,
        liftTimeSeconds: 7,
    },
    {
        id: 'resin_fast',
        mode: 'resin',
        label: 'Resin – Fast (0.1 mm)',
        printerName: 'ELEGOO Mars 5 Ultra',
        iniPath: path.join(PROFILES_DIR, 'resin', 'resin_fast.ini'),
        defaultLayerHeight: 0.1,
        defaultInfill: 100,
        densityGPerCm3: 1.1,
        buildVolumeMm: RESIN_BUILD_VOLUME,
        exposureTimeSeconds: 2.0,
        liftTimeSeconds: 6,
    },
];

const ALL_PROFILES: ProfileDefinition[] = [...FDM_PROFILES, ...RESIN_PROFILES];

export function getProfile(id: string): ProfileDefinition | undefined {
    return ALL_PROFILES.find((p) => p.id === id);
}

export function getDefaultProfileId(mode: PrintMode): string {
    if (mode === 'fdm') return 'fdm_petg_standard';
    return 'resin_standard_detail';
}

export function resolveProfile(params: SliceJobParams): ProfileDefinition {
    const profile = getProfile(params.profileId);
    if (!profile) throw new Error(`Unknown printer profile: ${params.profileId}`);
    return profile;
}

export { ALL_PROFILES };
