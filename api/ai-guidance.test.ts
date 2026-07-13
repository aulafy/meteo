import { describe, expect, it } from 'vitest';
import { AI_SYSTEM_PROMPT } from './ai-guidance';

describe('prompt de situación', () => {
  it('prohíbe inventar rutas y cortes', () => {
    expect(AI_SYSTEM_PROMPT).toContain('NO dispone de una ruta de evacuación verificada');
    expect(AI_SYSTEM_PROMPT).toContain('Solo menciona cortes o afecciones incluidos en traffic.incidents');
    expect(AI_SYSTEM_PROMPT).toContain('no cubren Cataluña ni País Vasco');
  });
});
