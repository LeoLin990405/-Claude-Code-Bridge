/** @license */
import { CCBProvider } from './CCBProvider';
export class GeminiProvider extends CCBProvider {
  constructor(model = '3f') {
    super('gemini', model);
  }
}
