/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Service layer exports
 */

export { UserService } from './user.service';
export { AuthService } from './auth.service';
export { TwoFactorService } from './twoFactor.service';
export { PasswordResetService } from './passwordReset.service';
export { OAuthService } from './oauth.service';
export { EmailService } from './email.service';
export { ConversationService } from './conversation.service';
export { ModelService } from './model.service';

// Singleton service instances
export const userService = new UserService();
export const authService = new AuthService();
export const twoFactorService = new TwoFactorService();
export const passwordResetService = new PasswordResetService();
export const oauthService = new OAuthService();
export const emailService = new EmailService();
export const conversationService = new ConversationService();
export const modelService = new ModelService();
