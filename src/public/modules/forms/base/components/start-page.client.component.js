'use strict'

const { FormLogoState } = require('../../../../../types')

angular.module('forms').component('startPageComponent', {
  templateUrl: 'modules/forms/base/componentViews/start-page.html',
  bindings: {
    logoUrl: '@',
    colorTheme: '@',
    estTimeTaken: '<',
    paragraph: '@',
    logoState: '@',
    formTitle: '@',
    authType: '<',
    isAdminPreview: '<',
    hasMyinfoFields: '<',
    isTemplate: '<',
    formLogin: '&',
  },
  controller: ['SpcpSession', 'Toastr', startPageController],
  controllerAs: 'vm',
})

function startPageController(SpcpSession, Toastr) {
  const vm = this

  vm.formLogout = SpcpSession.logout

  vm.rememberMe = {
    checked: false,
  }

  vm.$onInit = () => {
    vm.userName = SpcpSession.userName
    vm.FormLogoState = FormLogoState
    // Log out if form has MyInfo fields and user is logged in.
    if (
      vm.authType === 'SP' &&
      vm.userName &&
      vm.hasMyinfoFields &&
      SpcpSession.isRememberMeSet()
    ) {
      vm.formLogout()
    }

    if (SpcpSession.isJustLogOut()) {
      Toastr.success('You have been logged out')
    }

    if (SpcpSession.isLoginError()) {
      Toastr.error(
        'There was an unexpected error with your log in. Please try again later.',
      )
    }
  }

  const isInViewport = function () {
    if ($('#start-page-container').length) {
      let elementTop = $('#start-page-container').offset().top
      let elementBottom =
        elementTop + $('#start-page-container').outerHeight() - 110
      let viewportTop = $(window).scrollTop()
      let viewportBottom = viewportTop + $(window).height()
      return elementBottom > viewportTop && elementTop < viewportBottom
    }
  }

  $(window).on('resize scroll', function () {
    if (vm.isAdminPreview) {
      return
    }
    const header = document.getElementById('start-page-header')

    if (!header) {
      return
    }

    if (isInViewport()) {
      header.style.visibility = 'hidden'
    } else {
      header.style.visibility = 'visible'
    }
  })
}
