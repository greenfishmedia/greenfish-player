const webpack = require("webpack");
const Path = require("path");
const autoprefixer = require("autoprefixer");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

let plugins = [];
let entry = "./src/index.js";
let path = Path.resolve(__dirname, "dist");

const testTemplate = Path.join(__dirname, "test", "index.html");
const exampleTemplate = Path.join(__dirname, "examples", "index.html");

if(process.env.ANALYZE_BUNDLE) {
  plugins.push(new BundleAnalyzerPlugin());
}

if(process.env.TEST_PAGE) {
  entry = "./test/index.js";
  path = Path.resolve(__dirname, "test", "dist");

  plugins.push(
    new HtmlWebpackPlugin({
      title: "Eluvio Player Test",
      template: testTemplate,
      inject: "body",
      cache: false,
      filename: "index.html"
    })
  );
}

if(process.env.EXAMPLE_PAGE) {
  entry = "./examples/index.js";
  path = Path.resolve(__dirname, "examples", "dist");

  plugins.push(
    new HtmlWebpackPlugin({
      title: "Eluvio Player Example",
      template: exampleTemplate,
      inject: "body",
      cache: false,
      filename: "index.html"
    })
  );
}

module.exports = {
  entry,
  target: "web",
  output: {
    path,
    clean: true,
    filename: "[name].bundle.js",
    publicPath: "/",
    chunkFilename: "bundle.[id].[chunkhash].js"
  },
  devServer: {
    hot: true,
    historyApiFallback: true,
    allowedHosts: "all",
    port: 8089,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "POST"
    },
    // This is to allow configuration.js to be accessed
    static: {
      directory: Path.resolve(__dirname, "./config"),
      publicPath: "/"
    }
  },
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
  resolve: {
    fallback: {
      stream: require.resolve("stream-browserify"),
      url: require.resolve("url")
    },
    extensions: [".js", ".jsx", ".mjs", ".scss", ".png", ".svg"],
  },
  externals: {
    crypto: "crypto"
  },
  mode: "development",
  devtool: "eval-source-map",
  plugins,
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        exclude: /\.(theme|font)\.(css|scss)$/i,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              importLoaders: 2
            }
          },
          "postcss-loader",
          "sass-loader"
        ]
      },
      {
        test: /\.(js|mjs|jsx)$/,
        loader: "babel-loader",
        options: {
          presets: [
            "@babel/preset-env",
            "@babel/preset-react",
          ]
        }
      },
      {
        test: /\.svg$/,
        loader: "svg-inline-loader"
      },
      {
        test: /\.(gif|png|jpe?g|otf|woff2?|ttf)$/i,
        include: [ Path.resolve(__dirname, "src/static/public")],
        type: "asset/inline",
        generator: {
          filename: "public/[name][ext]"
        }
      },
      {
        test: /\.(gif|png|jpe?g|otf|woff2?|ttf)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(txt|bin|abi)$/i,
        type: "asset/source"
      }
    ]
  }
};

