import {z} from 'zod';
export const stockCode=z.string().trim().transform(v=>v.normalize('NFKC').toUpperCase()).pipe(z.string().min(1).max(50).regex(/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u));
