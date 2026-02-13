/** @license */
import { CCBProvider } from './CCBProvider';
export class KimiProvider extends CCBProvider {
  constructor(model = 'thinking') {
    super('kimi', model);
  }
}
