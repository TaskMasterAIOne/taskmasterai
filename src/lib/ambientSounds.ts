// src/lib/ambientSounds.ts
import { Wind, CloudRain, Coffee as CafeIcon, Music2, SunDim, Flame as FireIcon, Headphones, Waves, Bird } from 'lucide-react';
import React from 'react';

export interface AmbientSound {
  id: string;
  name: string;
  src: string;
  icon: React.ElementType;
  attribution?: string; // Optional: if required by the source
}

export const AMBIENT_SOUND_FILES: AmbientSound[] = [
  {
    id: 'none',
    name: 'None',
    src: '',
    icon: Headphones, // Or a specific "No Sound" icon if you have one
  },
  {
    id: 'whitenoise',
    name: 'White Noise',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/white-noise.mp3?alt=media&token=6f9530db-a4e8-4827-bba2-b698fdb2ff42',
    icon: Wind,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'rain',
    name: 'Rain',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/rain.mp3?alt=media&token=34994f15-4a10-42ac-9f9a-16f39f64b03b',
    icon: CloudRain,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'cafe',
    name: 'Cafe Ambience',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/cafe-ambience.mp3?alt=media&token=fd1c4fbc-9460-4e99-9c70-2753f3d7bda7',
    icon: CafeIcon,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'lofi',
    name: 'Lofi Beats',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/lofi.mp3?alt=media&token=9670da2f-0c9e-4247-9a0d-babca5bce05c',
    icon: Music2,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'forest',
    name: 'Forest',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/forest.mp3?alt=media&token=0cfefa52-ab75-4f01-8e76-5482ca472cfa',
    icon: Bird,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/fireplace.mp3?alt=media&token=bacb6dfe-6e27-4026-97b4-62e52df5707f',
    icon: FireIcon,
    // attribution: 'Pixabay', // Removed as source changed
  },
  {
    id: 'waves',
    name: 'Ocean Waves',
    src: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ocean-waves.mp3?alt=media&token=2407c9bc-a8a2-4eb5-8960-4c5ad4452115',
    icon: Waves,
    // attribution: 'Pixabay', // Removed as source changed
  }
];
