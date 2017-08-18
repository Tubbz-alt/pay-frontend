#!/usr/bin/env groovy

pipeline {
  agent any

  options {
    ansiColor('xterm')
    timestamps()
  }

  libraries {
    lib("pay-jenkins-library@PP-2497_decrease_frontend_image_size")
  }

  stages {
    stage('Docker Build') {
      steps {
        script {
          buildApp{
            app = "frontend"
          }
        }
      }
    }
    stage('Test') {
      steps {
        runEndToEnd("frontend")
      }
    }
    stage('Docker Tag') {
      steps {
        script {
          dockerTag {
            app = "frontend"
          }
        }
      }
    }
    stage('Deploy') {
      when {
        branch 'master'
      }
      steps {
        deploy("frontend", "test", null, true)
      }
    }
  }
}
