/** @license */
import { CCBProvider } from './CCBProvider';
export class ClaudeProvider extends CCBProvider {
  constructor(model = 'sonnet') {
    super('claude', model);
  }
}
