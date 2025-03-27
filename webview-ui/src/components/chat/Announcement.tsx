import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"
<<<<<<< HEAD
import { theme, commonStyles } from '../../theme'
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
// import VSCodeButtonLink from "./VSCodeButtonLink"
// import { getOpenRouterAuthUrl } from "./ApiOptions"
// import { vscode } from "../utils/vscode"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}
/*
You must update the latestAnnouncementId in ClineProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	return (
		<div
			style={{
<<<<<<< HEAD
				...commonStyles.card,
				background: theme.colors.background,
				padding: "12px 16px",
				margin: "5px 15px",
=======
				backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
				borderRadius: "3px",
				padding: "12px 16px",
				margin: "5px 15px 5px 15px",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				position: "relative",
				flexShrink: 0,
			}}>
			<VSCodeButton
				appearance="icon"
				onClick={hideAnnouncement}
<<<<<<< HEAD
				style={{
					position: "absolute",
					top: "8px",
					right: "8px",
					background: 'transparent',
					color: theme.colors.text,
					'&:hover': {
						background: `${theme.colors.primary}20`
					}
				}}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h2 style={{
				margin: "0 0 8px",
				color: theme.colors.primary,
				fontFamily: theme.typography.fontFamily,
				fontWeight: theme.typography.weights.bold
			}}>
				🎉{"  "}Introducing Optima AI 3.2
			</h2>

			<p style={{
				margin: 0,
				lineHeight: "1.5",
				color: theme.colors.text,
				fontFamily: theme.typography.fontFamily
			}}>
				Our biggest update yet is here - we're officially changing our name from Optima Cline to Optima AI! After
				growing beyond 50,000 installations, we've rebranded to better reflect our identity as we chart our own
				course.
			</p>

			<h3 style={{
				margin: "12px 0 8px",
				color: theme.colors.primary,
				fontFamily: theme.typography.fontFamily,
				fontWeight: theme.typography.weights.bold
			}}>
				Custom Modes: Celebrating Our New Identity
			</h3>
			<p style={{
				margin: "16px 0",
				lineHeight: "1.5",
				color: theme.colors.text,
				fontFamily: theme.typography.fontFamily
			}}>
				To mark this new chapter, we're introducing the power to shape Optima AI into any role you need! Create
				custom modes to extend capabilities in ways we never imagined. Whether you need a technical writer,
				accessibility expert, or security auditor - the possibilities are endless.
			</p>

			<h3 style={{
				margin: "12px 0 8px",
				color: theme.colors.primary,
				fontFamily: theme.typography.fontFamily,
				fontWeight: theme.typography.weights.bold
			}}>
				Join Us for the Next Chapter
			</h3>
			<p style={{
				margin: "16px 0 0",
				lineHeight: "1.5",
				color: theme.colors.text,
				fontFamily: theme.typography.fontFamily
			}}>
				We can't wait to see how you'll push Optima AI's potential even further! Share your custom modes and join
				the discussion at{" "}
				<VSCodeLink
					href="https://www.reddit.com/r/OptimaAI"
					style={{
						display: "inline",
						color: theme.colors.primary,
						textDecoration: "none",
						'&:hover': {
							textDecoration: "underline"
						}
					}}>
=======
				style={{ position: "absolute", top: "8px", right: "8px" }}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h2 style={{ margin: "0 0 8px" }}>🎉{"  "}Introducing Optima AI 3.2</h2>

			<p style={{ margin: "5px 0px" }}>
				Our biggest update yet is here - we're officially changing our name from Roo Code to Optima AI! After
				growing beyond 50,000 installations, we're ready to chart our own course. Our heartfelt thanks to
				everyone in the Code community who helped us reach this milestone.
			</p>

			<h3 style={{ margin: "12px 0 8px" }}>Custom Modes: Celebrating Our New Identity</h3>
			<p style={{ margin: "5px 0px" }}>
				To mark this new chapter, we're introducing the power to shape Optima AI into any role you need! Create
				specialized personas and create an entire team of agents with deeply customized prompts:
				<ul style={{ margin: "4px 0 6px 20px", padding: 0 }}>
					<li>QA Engineers who write thorough test cases and catch edge cases</li>
					<li>Product Managers who excel at user stories and feature prioritization</li>
					<li>UI/UX Designers who craft beautiful, accessible interfaces</li>
					<li>Code Reviewers who ensure quality and maintainability</li>
				</ul>
				Just click the <span className="codicon codicon-notebook" style={{ fontSize: "10px" }}></span> icon to
				get started with Custom Modes!
			</p>

			<h3 style={{ margin: "12px 0 8px" }}>Join Us for the Next Chapter</h3>
			<p style={{ margin: "5px 0px" }}>
				We can't wait to see how you'll push Optima AI's potential even further! Share your custom modes and join
				the discussion at{" "}
				<VSCodeLink href="https://www.reddit.com/r/OptimaAI" style={{ display: "inline" }}>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					reddit.com/r/OptimaAI
				</VSCodeLink>
				.
			</p>
		</div>
	)
}

export default memo(Announcement)
