/** @license */
import { CCBProvider } from './CCBProvider';
export class QwenProvider extends CCBProvider {
  constructor(model = 'coder') {
    super('qwen', model);
  }
}
