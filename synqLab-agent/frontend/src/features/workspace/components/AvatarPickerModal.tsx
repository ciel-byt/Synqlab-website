import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ImagePlus } from 'lucide-react'

// Simple SVG generator for builtin avatars
function createBuiltinSvgFile(color: string, pattern: number): File {
  let inner = ''
  if (pattern === 0) inner = `<circle cx="50" cy="50" r="30" fill="white" opacity="0.3"/>`
  else if (pattern === 1) inner = `<rect x="25" y="25" width="50" height="50" rx="10" fill="white" opacity="0.3"/>`
  else if (pattern === 2) inner = `<polygon points="50,15 85,80 15,80" fill="white" opacity="0.3"/>`
  else if (pattern === 3) inner = `<path d="M20,50 Q50,10 80,50 T20,50" fill="white" opacity="0.3"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" fill="${color}" />
    ${inner}
  </svg>`
  
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return new File([blob], `avatar-${color.replace('#', '')}.svg`, { type: 'image/svg+xml' })
}

const BUILTIN_AVATARS = [
  { cssVar: '--entity-0', pattern: 0 },
  { cssVar: '--entity-1', pattern: 1 },
  { cssVar: '--entity-2', pattern: 2 },
  { cssVar: '--entity-3', pattern: 3 },
  { cssVar: '--entity-4', pattern: 0 },
  { cssVar: '--entity-5', pattern: 1 },
  { cssVar: '--chart-3', pattern: 2 },
  { cssVar: '--primary', pattern: 3 },
]

export function AvatarPickerModal({
  open,
  onOpenChange,
  onUploadCustom,
  onSelectBuiltin
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadCustom: () => void
  onSelectBuiltin: (file: File) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Avatar</DialogTitle>
          <DialogDescription>
            Choose a built-in icon or upload your own image.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {BUILTIN_AVATARS.map((b, i) => (
              <button
                key={i}
                className="aspect-square rounded-xl overflow-hidden hover:scale-105 hover:shadow-md transition-all border border-border"
                style={{ backgroundColor: `hsl(var(${b.cssVar}))` }}
                onClick={() => {
                  const rawHsl = getComputedStyle(document.body).getPropertyValue(b.cssVar).trim()
                  onSelectBuiltin(createBuiltinSvgFile(`hsl(${rawHsl})`, b.pattern))
                  onOpenChange(false)
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  {b.pattern === 0 && <div className="w-10 h-10 rounded-full bg-current" />}
                  {b.pattern === 1 && <div className="w-10 h-10 rounded-lg bg-current" />}
                  {b.pattern === 2 && (
                    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-current">
                      <polygon points="50,15 85,80 15,80" />
                    </svg>
                  )}
                  {b.pattern === 3 && (
                    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-current">
                      <path d="M20,50 Q50,10 80,50 T20,50" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-semibold">Or</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setTimeout(onUploadCustom, 150) // wait for modal to close
              }}
            >
              <ImagePlus className="mr-2" size={16} />
              Upload custom image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
