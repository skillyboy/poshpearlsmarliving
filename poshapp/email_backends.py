import ssl

from django.core.mail.backends.smtp import EmailBackend


class InsecureSMTP(EmailBackend):
    """
    SMTP backend that disables certificate verification.
    Use ONLY for local development when behind an intercepting proxy/AV.
    Controlled via EMAIL_ALLOW_INSECURE_SSL env flag.
    """

    def _create_ssl_context(self, certfile=None, keyfile=None, ca_certs=None, cert_reqs=None):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context

    def _get_ssl_context(self):
        # Django 4.2 calls _create_ssl_context; keep this for compatibility.
        return self._create_ssl_context()

    def open(self):
        """
        Force SMTP_SSL with an unverified context to bypass local MITM in dev.
        """
        if self.connection:
            return False
        try:
            if self.use_ssl:
                self.connection = self.connection_class(
                    self.host,
                    self.port,
                    timeout=self.timeout,
                    context=self._create_ssl_context(),
                )
            else:
                # Fallback to base for non-SSL (will still work with TLS off)
                return super().open()
            if self.username and self.password:
                self.connection.login(self.username, self.password)
            return True
        except Exception:
            if self.fail_silently:
                return False
            raise
