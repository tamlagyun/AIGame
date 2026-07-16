import { z } from 'zod';
export const inputSchema = z.object({ clientTick: z.number().int().nonnegative(), moveX: z.number().min(-1).max(1), moveY: z.number().min(-1).max(1), rotation: z.number().finite() });
export const skillSchema = z.object({ skillId: z.enum(['skill-basic-bite', 'skill-dash-bite', 'skill-whale-swallow']), clientTick: z.number().int().nonnegative(), x: z.number().finite(), y: z.number().finite(), rotation: z.number().finite() });
export const clientMessageSchema = z.object({ protocolVersion: z.number().int(), type: z.enum(['joinRoom', 'input', 'skill', 'ping', 'leaveRoom']), requestId: z.string().optional(), payload: z.unknown() });
export type InputPayload = z.infer<typeof inputSchema>;
export type SkillPayload = z.infer<typeof skillSchema>;
