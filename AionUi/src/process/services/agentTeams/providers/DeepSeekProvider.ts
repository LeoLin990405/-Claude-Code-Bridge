/** @license */
import { CCBProvider } from './CCBProvider';
export class DeepSeekProvider extends CCBProvider {
  constructor(model = 'chat') {
    super('deepseek', model);
  }
}
