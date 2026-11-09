export type CardStatus = 'waiting' | 'generating' | 'done' | 'failed';

export interface Variation {
  index: number;
  name: string;
  description: string;
  motifTreatment?: string;
  stoneCount: number;
  stoneLayout: string;
  setting: string;
  sizeMm: string;
  goldVsOriginal: string;
  imagePrompt: string;
  status: CardStatus;
  imageBase64?: string;
  isStarred?: boolean;
  errorMessage?: string;
}

export interface OriginalAnalysis {
  productType: string;
  metal: string;
  motif: string;
  stoneCount: number;
  stoneLayout: string;
  summary: string;
}

export interface StudioJob {
  jobId: string;
  photoUrl: string;
  photoBase64?: string;
  sku: string;
  diamondCount: number;
  countFor: 'piece' | 'pair';
  stoneSize: string;
  metal: string;
  mustKeep: string;
  quality: 'low' | 'medium' | 'high';
  clusterRhodiumFill?: boolean;
  headShapeVariance?: boolean;
  original: OriginalAnalysis;
  variations: Variation[];
  createdAt: number;
}
