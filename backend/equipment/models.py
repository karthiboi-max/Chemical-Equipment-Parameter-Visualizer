from django.db import models

class Dataset(models.Model):
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_name = models.CharField(max_length=255)
    raw_csv = models.TextField()
    summary = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.file_name} @ {self.uploaded_at}"
