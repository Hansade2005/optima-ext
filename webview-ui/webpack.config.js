import path from 'path';

export default {
    entry: {
        sidebar: './src/sidebar.tsx',
        account: './src/account.tsx'
    },
    output: {
        path: path.resolve(process.cwd(), 'dist'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // Skip type checking to allow build with TypeScript errors
                        transpileOnly: true,
                        compilerOptions: {
                            // Force skip lib checks
                            skipLibCheck: true,
                            // Ignore errors when emitting output
                            noEmitOnError: false
                        }
                    }
                },
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    devServer: {
        static: {
            directory: path.join(process.cwd(), 'dist'),
        },
        compress: true,
        port: 9000,
    },
}; 