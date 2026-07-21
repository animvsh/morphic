'use server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { generateId } from '@/lib/db/schema'
import { getInsForgeAdminClient } from '@/lib/insforge/admin'

export async function submitFeedback(data: {
  sentiment: 'positive' | 'neutral' | 'negative'
  message: string
  pageUrl: string
}) {
  try {
    // Get current user if logged in
    let userId: string | undefined
    let userEmail: string | undefined

    const user = await getCurrentUser()
    userId = user?.id
    userEmail = user?.email

    // Get user agent from headers
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined

    const id = generateId()
    const client = getInsForgeAdminClient()
    const { error: insertError } = await client.database
      .from('brok_feedback')
      .insert({
        id,
        user_id: userId,
        sentiment: data.sentiment,
        message: data.message,
        page_url: data.pageUrl,
        user_agent: userAgent
      })
    if (insertError) throw insertError

    // Send to Slack if webhook URL is configured
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
    if (slackWebhookUrl) {
      try {
        const sentimentEmoji = {
          positive: '😊',
          neutral: '😐',
          negative: '😞'
        }[data.sentiment]

        const slackMessage = {
          text: `New feedback received ${sentimentEmoji}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `New Feedback ${sentimentEmoji}`
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Sentiment:*\n${data.sentiment}`
                },
                {
                  type: 'mrkdwn',
                  text: `*From:*\n${userEmail || 'Anonymous'}`
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message:*\n${data.message}`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Page: ${data.pageUrl} | Time: ${new Date().toISOString()}`
                }
              ]
            }
          ]
        }

        // Add timeout to prevent hanging if Slack is unresponsive
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10 seconds

        try {
          await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(slackMessage),
            signal: controller.signal
          })
        } finally {
          clearTimeout(timeout)
        }
      } catch (slackError) {
        // Log Slack error but don't fail the request
        console.error('Failed to send Slack notification:', slackError)
      }
    }

    return { success: true, id }
  } catch (error) {
    console.error('Failed to save feedback:', error)
    return { success: false, error: 'Failed to save feedback' }
  }
}
