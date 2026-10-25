/**
 * MarkdownContent — renders markdown content with academic styling.
 *
 * Uses basic regex parsing for common markdown patterns.
 * For full markdown support, consider adding react-markdown.
 */

import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  // Convert markdown to HTML-safe JSX
  const renderContent = () => {
    if (!content) return null

    // Split by code blocks first to preserve them
    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, i) => {
      // Code blocks
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/)
        if (match) {
          const [, , code] = match
          return (
            <pre key={i} className="my-3 rounded-lg bg-muted/80 border border-border/50 p-3 overflow-x-auto">
              <code className="text-xs font-mono text-foreground">{code.trim()}</code>
            </pre>
          )
        }
      }

      // Process inline markdown
      return <span key={i}>{renderInlineMarkdown(part)}</span>
    })
  }

  const renderInlineMarkdown = (text: string) => {
    // Split into lines for block-level processing
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let currentParagraph: string[] = []
    let inList = false
    let listItems: string[] = []

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join('\n')
        elements.push(
          <p key={elements.length} className="mb-3 last:mb-0">
            {renderInlineFormatting(paragraphText)}
          </p>
        )
        currentParagraph = []
      }
    }

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="mb-3 ml-4 list-disc space-y-1">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm">{renderInlineFormatting(item)}</li>
            ))}
          </ul>
        )
        listItems = []
        inList = false
      }
    }

    lines.forEach((line) => {
      // Headers
      if (line.startsWith('### ')) {
        flushParagraph()
        flushList()
        elements.push(
          <h4 key={elements.length} className="text-sm font-semibold mt-4 mb-2">
            {renderInlineFormatting(line.slice(4))}
          </h4>
        )
      } else if (line.startsWith('## ')) {
        flushParagraph()
        flushList()
        elements.push(
          <h3 key={elements.length} className="text-base font-semibold mt-4 mb-2">
            {renderInlineFormatting(line.slice(3))}
          </h3>
        )
      } else if (line.startsWith('# ')) {
        flushParagraph()
        flushList()
        elements.push(
          <h2 key={elements.length} className="text-lg font-bold mt-4 mb-2">
            {renderInlineFormatting(line.slice(2))}
          </h2>
        )
      }
      // Bullet lists
      else if (line.match(/^[\-\*]\s/)) {
        flushParagraph()
        inList = true
        listItems.push(line.slice(2))
      }
      // Numbered lists
      else if (line.match(/^\d+\.\s/)) {
        flushParagraph()
        inList = true
        listItems.push(line.replace(/^\d+\.\s/, ''))
      }
      // Empty line
      else if (line.trim() === '') {
        flushParagraph()
        flushList()
      }
      // Regular text
      else {
        if (inList) {
          flushList()
        }
        currentParagraph.push(line)
      }
    })

    flushParagraph()
    flushList()

    return elements
  }

  const renderInlineFormatting = (text: string): React.ReactNode => {
    // Process inline formatting: bold, italic, code, links
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/^`([^`]+)`/)
      if (codeMatch) {
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
            {codeMatch[1]}
          </code>
        )
        remaining = remaining.slice(codeMatch[0].length)
        continue
      }

      // Bold
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
      if (boldMatch) {
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>)
        remaining = remaining.slice(boldMatch[0].length)
        continue
      }

      // Italic
      const italicMatch = remaining.match(/^\*([^*]+)\*/)
      if (italicMatch) {
        parts.push(<em key={key++}>{italicMatch[1]}</em>)
        remaining = remaining.slice(italicMatch[0].length)
        continue
      }

      // Links - only render as clickable if URL is valid
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]*)\)/)
      if (linkMatch) {
        const linkText = linkMatch[1]
        const linkUrl = linkMatch[2].trim()
        // Only render as link if URL is non-empty and looks valid
        if (linkUrl && (linkUrl.startsWith('http://') || linkUrl.startsWith('https://') || linkUrl.startsWith('/'))) {
          parts.push(
            <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {linkText}
            </a>
          )
        } else {
          // Invalid or empty URL - render as plain text
          parts.push(<span key={key++}>{linkText}</span>)
        }
        remaining = remaining.slice(linkMatch[0].length)
        continue
      }

      // Regular character
      const nextSpecial = remaining.search(/[`*\[]/)
      if (nextSpecial === -1) {
        parts.push(remaining)
        break
      } else if (nextSpecial === 0) {
        parts.push(remaining[0])
        remaining = remaining.slice(1)
      } else {
        parts.push(remaining.slice(0, nextSpecial))
        remaining = remaining.slice(nextSpecial)
      }
    }

    return parts.length === 1 ? parts[0] : parts
  }

  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      {renderContent()}
    </div>
  )
}
