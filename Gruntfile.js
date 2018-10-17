const path = require('path')

module.exports = function (grunt) {
  const sass = {
    dev: {
      options: {
        style: 'expanded',
        sourcemap: true,
        includePaths: [
          'node_modules',
          'govuk_modules'
        ],
        outputStyle: 'compressed'
      },
      files: [{
        expand: true,
        cwd: 'app/assets/sass',
        src: ['*.scss', 'custom/*.scss'],
        dest: 'public/stylesheets/',
        ext: '.css'
      }]
    }
  }

  const copy = {
    assets: {
      files: [{
        expand: true,
        cwd: 'app/assets/images/',
        src: ['**', '**/*'],
        dest: 'public/images/'
      }]
    },
    payProductPage: {
      files: [{
        expand: true,
        cwd: 'node_modules/pay-product-page',
        src: ['**', '!package.json'],
        dest: 'public'
      }]
    },
    applePayVerification: {
      files: [{
        expand: true,
        cwd: 'app/assets/apple-pay',
        src: ['**'],
        dest: 'public/.well-known'
      }]
    },
    countryAutocompleteFiles: {
      files: [{
        expand: true,
        cwd: 'node_modules/govuk-country-and-territory-autocomplete/dist/',
        src: '**',
        dest: 'govuk_modules/govuk-country-and-territory-autocomplete/',
        rename: (dest, src) => dest + src.replace('min.css', 'scss')
      }]
    }
  }

  const rewrite = {
    'application.css': {
      src: 'public/stylesheets/application.css',
      editor: function (contents) {
        const staticify = require('staticify')(path.join(__dirname, 'public'))

        return staticify.replacePaths(contents)
      }
    }
  }

  const watch = {
    assets: {
      files: ['app/assets/sass/**/*.scss'],
      tasks: ['sass'],
      options: {
        spawn: false,
        livereload: true
      }
    }
  }

  const nodeMon = {
    dev: {
      script: 'server.js',
      options: {
        ext: 'js',
        ignore: ['node_modules/**', 'app/assets/**', 'public/**'],
        args: ['-i=true']
      }
    }
  }

  const concurrent = {
    target: {
      tasks: ['watch', 'nodemon'],
      options: {
        logConcurrentOutput: true
      }
    }
  }

  const browserify = {
    'public/javascripts/application.js': ['app/browsered.js'],
    options: {
      browserifyOptions: {
        standalone: 'module'
      }
    }
  }

  const babel = {
    options: {
      presets: ['@babel/preset-env']
    },
    dist: {
      files: {
        'public/javascripts/application.js': 'public/javascripts/application.js'
      }
    }
  }

  const concat = {
    options: {
      separator: ';'
    },
    dist: {
      src: ['public/javascripts/application.js',
        'node_modules/promise-polyfill/dist/polyfill.min.js',
        'app/assets/javascripts/modules/*.js'],
      dest: 'public/javascripts/application.js'
    }
  }

  const uglify = {
    my_target: {
      files: {
        'public/javascripts/application.min.js': ['public/javascripts/application.js']
      }
    },
    options: {
      sourceMap: true
    }
  }

  const compress = {
    main: {
      options: {
        mode: 'gzip'
      },
      files: [
        {expand: true, src: ['public/images/*.jpg'], ext: '.jpg.gz'},
        {expand: true, src: ['public/images/*.gif'], ext: '.gif.gz'},
        {expand: true, src: ['public/images/*.png'], ext: '.png.gz'},
        {expand: true, src: ['public/javascripts/*.min.js'], ext: '.min.js.gz'},
        {expand: true, src: ['public/stylesheets/*.css'], ext: '.css.gz'},
        {expand: true, src: ['public/stylesheets/custom/*.css'], ext: '.css.gz'}
      ]
    }
  }

  grunt.initConfig({
    // Clean
    clean: ['public', 'govuk_modules'],
    // Builds Sass
    sass: sass,
    // Copies templates and assets from external modules and dirs
    copy: copy,
    // Watches assets and sass for changes
    watch: watch,
    // nodemon watches for changes and restarts app
    nodemon: nodeMon,
    concurrent: concurrent,
    browserify: browserify,
    concat: concat,
    babel: babel,
    rewrite: rewrite,
    uglify: uglify,
    compress: compress
  });

  [
    'grunt-contrib-copy',
    'grunt-contrib-compress',
    'grunt-contrib-watch',
    'grunt-contrib-clean',
    'grunt-sass',
    'grunt-nodemon',
    'grunt-concurrent',
    'grunt-browserify',
    'grunt-contrib-concat',
    'grunt-rewrite',
    'grunt-contrib-uglify',
    'grunt-babel'
  ].forEach(task => grunt.loadNpmTasks(task))

  grunt.registerTask('generate-assets', [
    'clean',
    'copy',
    'sass',
    'rewrite',
    'browserify',
    'babel',
    'concat',
    'uglify',
    'compress'
  ])

  grunt.registerTask('default', [
    'generate-assets',
    'concurrent:target'
  ])
}
