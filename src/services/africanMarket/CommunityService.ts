import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface CommunityMember {
    id: string;
    username: string;
    displayName: string;
    region: string;
    languages: string[];
    expertise: string[];
    joinDate: number;
    lastActive: number;
    reputation: number;
    contributions: {
        posts: number;
        comments: number;
        solutions: number;
    };
}

interface CommunityPost {
    id: string;
    authorId: string;
    title: string;
    content: string;
    tags: string[];
    category: 'question' | 'discussion' | 'tutorial' | 'announcement';
    createdAt: number;
    updatedAt: number;
    likes: number;
    views: number;
    comments: number;
    status: 'active' | 'closed' | 'archived';
}

interface CommunityComment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    likes: number;
    isSolution: boolean;
}

export class CommunityService {
    private static instance: CommunityService;
    private context: vscode.ExtensionContext;
    private members: Map<string, CommunityMember> = new Map();
    private posts: Map<string, CommunityPost> = new Map();
    private comments: Map<string, CommunityComment> = new Map();
    private config: {
        enabled: boolean;
        defaultLanguage: string;
        supportedLanguages: string[];
        moderationEnabled: boolean;
        autoTranslateEnabled: boolean;
    };

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        this.initializeData();
    }

    public static getInstance(context: vscode.ExtensionContext): CommunityService {
        if (!CommunityService.instance) {
            CommunityService.instance = new CommunityService(context);
        }
        return CommunityService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
        return {
            enabled: config.get('community.enabled') || false,
            defaultLanguage: config.get('community.defaultLanguage') || 'en',
            supportedLanguages: config.get('community.supportedLanguages') || ['en', 'sw', 'ha', 'yo', 'am', 'zu'],
            moderationEnabled: config.get('community.moderationEnabled') || true,
            autoTranslateEnabled: config.get('community.autoTranslateEnabled') || true
        };
    }

    private async initializeData(): Promise<void> {
        await this.loadMembers();
        await this.loadPosts();
        await this.loadComments();
    }

    private async loadMembers(): Promise<void> {
        const membersPath = path.join(this.context.globalStorageUri.fsPath, 'community_members.json');
        try {
            if (await fs.promises.access(membersPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(membersPath, 'utf8');
                const members = JSON.parse(content);
                this.members = new Map(Object.entries(members));
            }
        } catch (error) {
            console.error('Failed to load community members:', error);
        }
    }

    private async loadPosts(): Promise<void> {
        const postsPath = path.join(this.context.globalStorageUri.fsPath, 'community_posts.json');
        try {
            if (await fs.promises.access(postsPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(postsPath, 'utf8');
                const posts = JSON.parse(content);
                this.posts = new Map(Object.entries(posts));
            }
        } catch (error) {
            console.error('Failed to load community posts:', error);
        }
    }

    private async loadComments(): Promise<void> {
        const commentsPath = path.join(this.context.globalStorageUri.fsPath, 'community_comments.json');
        try {
            if (await fs.promises.access(commentsPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(commentsPath, 'utf8');
                const comments = JSON.parse(content);
                this.comments = new Map(Object.entries(comments));
            }
        } catch (error) {
            console.error('Failed to load community comments:', error);
        }
    }

    private async saveMembers(): Promise<void> {
        const membersPath = path.join(this.context.globalStorageUri.fsPath, 'community_members.json');
        try {
            const members = Object.fromEntries(this.members);
            await fs.promises.writeFile(membersPath, JSON.stringify(members));
        } catch (error) {
            console.error('Failed to save community members:', error);
        }
    }

    private async savePosts(): Promise<void> {
        const postsPath = path.join(this.context.globalStorageUri.fsPath, 'community_posts.json');
        try {
            const posts = Object.fromEntries(this.posts);
            await fs.promises.writeFile(postsPath, JSON.stringify(posts));
        } catch (error) {
            console.error('Failed to save community posts:', error);
        }
    }

    private async saveComments(): Promise<void> {
        const commentsPath = path.join(this.context.globalStorageUri.fsPath, 'community_comments.json');
        try {
            const comments = Object.fromEntries(this.comments);
            await fs.promises.writeFile(commentsPath, JSON.stringify(comments));
        } catch (error) {
            console.error('Failed to save community comments:', error);
        }
    }

    public async createMember(member: Omit<CommunityMember, 'id' | 'joinDate' | 'lastActive' | 'reputation' | 'contributions'>): Promise<CommunityMember> {
        const newMember: CommunityMember = {
            ...member,
            id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            joinDate: Date.now(),
            lastActive: Date.now(),
            reputation: 0,
            contributions: {
                posts: 0,
                comments: 0,
                solutions: 0
            }
        };

        this.members.set(newMember.id, newMember);
        await this.saveMembers();
        return newMember;
    }

    public async createPost(post: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'views' | 'comments' | 'status'>): Promise<CommunityPost> {
        const newPost: CommunityPost = {
            ...post,
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            likes: 0,
            views: 0,
            comments: 0,
            status: 'active'
        };

        this.posts.set(newPost.id, newPost);
        await this.savePosts();

        // Update member's post count
        const member = this.members.get(post.authorId);
        if (member) {
            member.contributions.posts++;
            member.lastActive = Date.now();
            await this.saveMembers();
        }

        return newPost;
    }

    public async createComment(comment: Omit<CommunityComment, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'isSolution'>): Promise<CommunityComment> {
        const newComment: CommunityComment = {
            ...comment,
            id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            likes: 0,
            isSolution: false
        };

        this.comments.set(newComment.id, newComment);
        await this.saveComments();

        // Update post's comment count
        const post = this.posts.get(comment.postId);
        if (post) {
            post.comments++;
            post.updatedAt = Date.now();
            await this.savePosts();
        }

        // Update member's comment count
        const member = this.members.get(comment.authorId);
        if (member) {
            member.contributions.comments++;
            member.lastActive = Date.now();
            await this.saveMembers();
        }

        return newComment;
    }

    public async markCommentAsSolution(commentId: string): Promise<void> {
        const comment = this.comments.get(commentId);
        if (!comment) {
            throw new Error(`Comment ${commentId} not found`);
        }

        comment.isSolution = true;
        await this.saveComments();

        // Update member's solution count
        const member = this.members.get(comment.authorId);
        if (member) {
            member.contributions.solutions++;
            member.reputation += 10;
            await this.saveMembers();
        }

        // Close the post
        const post = this.posts.get(comment.postId);
        if (post) {
            post.status = 'closed';
            await this.savePosts();
        }
    }

    public async likePost(postId: string, userId: string): Promise<void> {
        const post = this.posts.get(postId);
        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        post.likes++;
        await this.savePosts();

        // Update author's reputation
        const author = this.members.get(post.authorId);
        if (author) {
            author.reputation += 2;
            await this.saveMembers();
        }
    }

    public async likeComment(commentId: string, userId: string): Promise<void> {
        const comment = this.comments.get(commentId);
        if (!comment) {
            throw new Error(`Comment ${commentId} not found`);
        }

        comment.likes++;
        await this.saveComments();

        // Update author's reputation
        const author = this.members.get(comment.authorId);
        if (author) {
            author.reputation += 1;
            await this.saveMembers();
        }
    }

    public getMember(memberId: string): CommunityMember | null {
        return this.members.get(memberId) || null;
    }

    public getPost(postId: string): CommunityPost | null {
        return this.posts.get(postId) || null;
    }

    public getComment(commentId: string): CommunityComment | null {
        return this.comments.get(commentId) || null;
    }

    public getPostComments(postId: string): CommunityComment[] {
        return Array.from(this.comments.values())
            .filter(comment => comment.postId === postId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    public getMemberPosts(memberId: string): CommunityPost[] {
        return Array.from(this.posts.values())
            .filter(post => post.authorId === memberId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    public getMemberComments(memberId: string): CommunityComment[] {
        return Array.from(this.comments.values())
            .filter(comment => comment.authorId === memberId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    public searchPosts(query: string, filters: {
        category?: CommunityPost['category'];
        tags?: string[];
        authorId?: string;
    } = {}): CommunityPost[] {
        return Array.from(this.posts.values())
            .filter(post => {
                if (filters.category && post.category !== filters.category) return false;
                if (filters.tags && !filters.tags.every(tag => post.tags.includes(tag))) return false;
                if (filters.authorId && post.authorId !== filters.authorId) return false;
                return post.title.toLowerCase().includes(query.toLowerCase()) ||
                       post.content.toLowerCase().includes(query.toLowerCase());
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    public getTopContributors(limit: number = 10): CommunityMember[] {
        return Array.from(this.members.values())
            .sort((a, b) => b.reputation - a.reputation)
            .slice(0, limit);
    }

    public getPopularPosts(limit: number = 10): CommunityPost[] {
        return Array.from(this.posts.values())
            .sort((a, b) => (b.views + b.likes) - (a.views + a.likes))
            .slice(0, limit);
    }

    public dispose(): void {
        this.members.clear();
        this.posts.clear();
        this.comments.clear();
    }
} 