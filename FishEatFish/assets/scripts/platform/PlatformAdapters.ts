import type { PlatformService, PlatformTarget } from './PlatformService.ts';
import { PlatformServiceEditor } from './PlatformServiceEditor.ts';

export const SDK_REQUIRED_TARGETS = ['wechat', 'douyin', 'android', 'ios', 'harmonyos'] as const;

export const createPlatformService = (target: PlatformTarget): PlatformService => {
  if (target === 'editor' || target === 'web') return new PlatformServiceEditor();
  throw new Error(`Platform adapter for ${target} requires its SDK integration.`);
};

