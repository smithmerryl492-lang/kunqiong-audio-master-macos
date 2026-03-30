export interface FeedbackUrlResult {
  code: number
  msg: string
  data: {
    url: string
  } | null
}

const API_BASE = 'https://api-web.kunqiongai.com'

export async function getFeedbackUrl(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/soft_desktop/get_feedback_url`, {
      method: 'POST'
    })
    const result: FeedbackUrlResult = await response.json()
    if (result.code === 1 && result.data?.url) {
      return result.data.url
    }
    return null
  } catch (error) {
    console.error('Failed to get feedback url:', error)
    return null
  }
}
