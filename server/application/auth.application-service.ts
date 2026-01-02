import { AuthDomainService } from "../domain/users/auth.domain-service";
import { ISessionAdapter } from "../infrastructure/session.adapter";

export class AuthApplicationService {
  private authDomainService: AuthDomainService;
  private sessionAdapter: ISessionAdapter;

  constructor(authDomainService: AuthDomainService, sessionAdapter: ISessionAdapter) {
    this.authDomainService = authDomainService;
    this.sessionAdapter = sessionAdapter;
  }

  public async login(email: string, password: string) {
    const authResult = await this.authDomainService.login(email, password);
    if (authResult) {
      this.sessionAdapter.setSession(authResult.id, authResult.role);
    }
    return authResult;
  }

  public async logout() {
    await this.sessionAdapter.destroySession();
  }

  public async getAuthenticatedUser() {
    const userId = this.sessionAdapter.getUserId();
    if (!userId) {
      return null;
    }
    return this.authDomainService.getAuthenticatedUser(userId);
  }
}
