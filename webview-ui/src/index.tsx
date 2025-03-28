import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'

import "./index.css"
import App from "./App"
import "../../node_modules/@vscode/codicons/dist/codicon.css"

// Create a new cache for emotion to use
const emotionCache = createCache({
	key: 'optima-emotion',
	prepend: true, // ensures styles are prepended to the <head>, preventing CSS specificity issues
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<CacheProvider value={emotionCache}>
			<App />
		</CacheProvider>
	</StrictMode>,
)
