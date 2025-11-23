# config/views.py
from django.http import HttpResponse

def home(request):
    return HttpResponse("Chemical Equipment Parameter Visualizer Backend is running 🚀")
