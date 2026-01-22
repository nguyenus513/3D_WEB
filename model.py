from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8045/v1",
    api_key="sk-a1bf8900030544e1a4c50a44c412a4a6"
)

response = client.chat.completions.create(
    model="claude-opus-4-5-thinking",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)