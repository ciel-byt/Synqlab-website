import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', 'class'],
  theme: {
  	container: {
  		center: true,
  		padding: '1.5rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			surface: {
  				DEFAULT: 'hsl(var(--surface))',
  				muted: 'hsl(var(--surface-muted))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			subtle: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))',
  				light: 'hsl(var(--surface))',
  				muted: 'hsl(var(--muted-foreground))',
  				text: 'hsl(var(--foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			slate: {
  				'50': '#f8fafc',
  				'100': '#f1f5f9',
  				'200': '#e2e8f0',
  				'300': '#94a3b8',
  				'400': '#64748b',
  				'500': '#475569',
  				'600': '#334155',
  				'700': '#1e293b',
  				'800': '#1e293b',
  				'900': '#0f172a',
  				'950': '#020617'
  			},
  			status: {
  				ok: 'hsl(var(--status-ok))',
  				'ok-bg': 'hsl(var(--status-ok-bg))',
  				'ok-text': 'hsl(var(--status-ok-text))',
  				warn: 'hsl(var(--status-warn))',
  				'warn-bg': 'hsl(var(--status-warn-bg))',
  				'warn-text': 'hsl(var(--status-warn-text))',
  				err: 'hsl(var(--status-err))',
  				'err-bg': 'hsl(var(--status-err-bg))',
  				'err-text': 'hsl(var(--status-err-text))',
  				info: 'hsl(var(--status-info))',
  				'info-bg': 'hsl(var(--status-info-bg))',
  				'info-text': 'hsl(var(--status-info-text))',
  				green: 'hsl(var(--status-ok))',
  				'green-bg': 'hsl(var(--status-ok-bg))',
  				'green-text': 'hsl(var(--status-ok-text))',
  				amber: 'hsl(var(--status-warn))',
  				'amber-bg': 'hsl(var(--status-warn-bg))',
  				'amber-text': 'hsl(var(--status-warn-text))',
  				red: 'hsl(var(--status-err))',
  				'red-bg': 'hsl(var(--status-err-bg))',
  				'red-text': 'hsl(var(--status-err-text))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))',
  			},
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)'
  			],
  			serif: [
  				'var(--font-serif)'
  			],
  			mono: [
  				'var(--font-mono)'
  			]
  		},
  		borderRadius: {
  			sm: 'var(--radius-sm)',
  			DEFAULT: 'var(--radius)',
  			md: 'var(--radius)',
  			lg: 'var(--radius-lg)'
  		},
  		boxShadow: {
  			xs: '0 1px 2px hsl(var(--foreground) / 0.04)',
  			sm: '0 1px 3px hsl(var(--foreground) / 0.06)',
  			md: '0 4px 12px hsl(var(--foreground) / 0.07)',
  			ring: '0 0 0 3px hsl(var(--ring) / 0.18)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				from: {
  					transform: 'translateY(8px)',
  					opacity: '0'
  				},
  				to: {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.15s ease-out',
  			'slide-up': 'slide-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [animate],
}
