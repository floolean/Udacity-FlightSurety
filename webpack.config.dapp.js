const path = require("path");
const nodeExternals = require("webpack-node-externals");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
	target: "web",
	entry: ["babel-polyfill", path.join(__dirname, "src/dapp")],
	output: {
		path: path.join(__dirname, "prod/dapp"),
		filename: "bundle.js",
		libraryTarget: "window",
	},
	devtool: "source-map",
	externals: [
		nodeExternals({
			allowlist: [
				/webpack\/hot/,
				/webpack-dev-server/,
				/ansi-html-community/,
				/html-entities/,
				/events/,
				/web3\/dist/,
				/moment\/dist/,
			],
			importType: "window",
		}),
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				use: "babel-loader",
				exclude: /node_modules/,
			},
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader"],
				exclude: /node_modules/,
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				use: {
					loader: "file-loader",
					options: {
						esModule: false,
					},
				},
				exclude: /node_modules/,
			},
			{
				test: /\.html$/,
				use: "html-loader",
				exclude: /node_modules/,
			},
			{ test: /\.node$/, use: "raw-loader" },
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(__dirname, "src/dapp/index.html"),
		}),
	],
	resolve: {
		extensions: [".js"],
		/*
		fallback: {
			vm: false,
			os: false,
			fs: false,
			url: false,
			http: false,
			path: false,
			zlib: false,
			https: false,
			stream: false,
			assert: false,
			crypto: false,
			esbuild: false,
			process: false,
			constants: false,
			querystring: false,
			child_process: false,
			worker_threads: false,
		},*/
	},
	devServer: {
		static: {
			directory: path.join(__dirname, "src/dapp"),
		},
		port: 8000,
		liveReload: true,
		hot: true,
	},
};
