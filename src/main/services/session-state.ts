export class SessionState {
  private authToken: string | null = null

  setAuthToken(token: string | null) {
    this.authToken = token && token.trim() ? token.trim() : null
  }

  getAuthToken() {
    return this.authToken
  }
}
